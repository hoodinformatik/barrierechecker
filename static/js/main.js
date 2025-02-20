document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('checkForm');
    const urlInput = document.getElementById('urlInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const results = document.getElementById('results');
    const issuesAccordion = document.getElementById('issuesAccordion');
    const summary = document.getElementById('summary').querySelector('.alert');
    const accessibilityScore = document.getElementById('accessibilityScore');

    // Smooth scroll to sections
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI
        results.classList.add('d-none');
        loadingIndicator.classList.remove('d-none');
        issuesAccordion.innerHTML = '';
        
        try {
            const response = await fetch('/check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: urlInput.value
                })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error);
            }
            
            // Calculate accessibility score
            const maxIssues = 20; // Assuming this is the worst case
            const score = Math.max(0, Math.min(100, 100 - (data.total_issues / maxIssues * 100)));
            accessibilityScore.style.width = score + '%';
            accessibilityScore.setAttribute('aria-valuenow', score);
            
            // Group issues by category
            const groupedIssues = {
                'Bilder & Medien': [],
                'Navigation & Interaktion': [],
                'Farben & Kontrast': [],
                'Struktur & Semantik': []
            };

            data.issues.forEach(issue => {
                // Categorize issues
                if (issue.message.toLowerCase().includes('alt-text') || 
                    issue.message.toLowerCase().includes('bild')) {
                    groupedIssues['Bilder & Medien'].push(issue);
                } else if (issue.message.toLowerCase().includes('aria') || 
                         issue.message.toLowerCase().includes('formular')) {
                    groupedIssues['Navigation & Interaktion'].push(issue);
                } else if (issue.message.toLowerCase().includes('kontrast') || 
                         issue.message.toLowerCase().includes('farbe')) {
                    groupedIssues['Farben & Kontrast'].push(issue);
                } else {
                    groupedIssues['Struktur & Semantik'].push(issue);
                }
            });

            // Create accordion items for each category
            Object.entries(groupedIssues).forEach(([category, issues], index) => {
                if (issues.length > 0) {
                    const accordionItem = document.createElement('div');
                    accordionItem.className = 'accordion-item';
                    
                    const headerId = `heading${index}`;
                    const collapseId = `collapse${index}`;
                    
                    accordionItem.innerHTML = `
                        <h2 class="accordion-header" id="${headerId}">
                            <button class="accordion-button ${index !== 0 ? 'collapsed' : ''}" type="button" 
                                    data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                                ${category} <span class="badge bg-${issues.some(i => i.type === 'error') ? 'danger' : 'warning'} ms-2">
                                    ${issues.length}
                                </span>
                            </button>
                        </h2>
                        <div id="${collapseId}" class="accordion-collapse collapse ${index === 0 ? 'show' : ''}" 
                             data-bs-parent="#issuesAccordion">
                            <div class="accordion-body">
                                ${issues.map(issue => `
                                    <div class="issue-item mb-3 p-3 rounded ${issue.type === 'error' ? 'bg-danger' : 'bg-warning'} bg-opacity-10">
                                        <div class="d-flex align-items-start">
                                            <div class="flex-shrink-0">
                                                <i class="fas fa-${issue.type === 'error' ? 'times-circle text-danger' : 'exclamation-triangle text-warning'} fa-lg"></i>
                                            </div>
                                            <div class="flex-grow-1 ms-3">
                                                <h5 class="mb-1">${issue.message}</h5>
                                                <p class="mb-0 text-muted"><small>${issue.element}</small></p>
                                                ${getFixSuggestion(issue.message)}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                    
                    issuesAccordion.appendChild(accordionItem);
                }
            });
            
            // Update summary
            let alertClass, summaryMessage;
            if (score >= 90) {
                alertClass = 'alert-success';
                summaryMessage = `<i class="fas fa-check-circle me-2"></i>Ausgezeichnet! Ihre Webseite erreicht einen Barrierefreiheits-Score von ${Math.round(score)}%.`;
            } else if (score >= 70) {
                alertClass = 'alert-warning';
                summaryMessage = `<i class="fas fa-exclamation-circle me-2"></i>Gut! Ihre Webseite erreicht einen Barrierefreiheits-Score von ${Math.round(score)}%. Es gibt noch Verbesserungspotential.`;
            } else {
                alertClass = 'alert-danger';
                summaryMessage = `<i class="fas fa-times-circle me-2"></i>Achtung: Ihre Webseite erreicht nur einen Barrierefreiheits-Score von ${Math.round(score)}%. Bitte beheben Sie die aufgeführten Probleme.`;
            }
            
            summary.className = `alert ${alertClass}`;
            summary.innerHTML = summaryMessage;
            
        } catch (error) {
            summary.className = 'alert alert-danger';
            summary.innerHTML = `<i class="fas fa-times-circle me-2"></i>${error.message}`;
            issuesAccordion.innerHTML = '';
            accessibilityScore.style.width = '0%';
        }
        
        // Show results with animation
        loadingIndicator.classList.add('d-none');
        results.classList.remove('d-none');
        results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

// Helper function to provide fix suggestions
function getFixSuggestion(message) {
    const suggestions = {
        'alt-text': `
            <div class="mt-2 p-2 border-start border-primary border-3">
                <strong>Lösung:</strong> Fügen Sie einen beschreibenden Alt-Text hinzu:
                <code class="d-block mt-2 p-2 bg-light">
                    &lt;img src="bild.jpg" alt="Beschreibender Text für das Bild"&gt;
                </code>
            </div>
        `,
        'aria-label': `
            <div class="mt-2 p-2 border-start border-primary border-3">
                <strong>Lösung:</strong> Fügen Sie ein ARIA-Label hinzu:
                <code class="d-block mt-2 p-2 bg-light">
                    &lt;button aria-label="Menü öffnen"&gt;☰&lt;/button&gt;
                </code>
            </div>
        `,
        'überschriften': `
            <div class="mt-2 p-2 border-start border-primary border-3">
                <strong>Lösung:</strong> Verwenden Sie eine korrekte Überschriftenhierarchie:
                <code class="d-block mt-2 p-2 bg-light">
                    &lt;h1&gt;Hauptüberschrift&lt;/h1&gt;<br>
                    &lt;h2&gt;Unterüberschrift&lt;/h2&gt;
                </code>
            </div>
        `,
        'formular': `
            <div class="mt-2 p-2 border-start border-primary border-3">
                <strong>Lösung:</strong> Verbinden Sie Label mit Formularelementen:
                <code class="d-block mt-2 p-2 bg-light">
                    &lt;label for="name"&gt;Name:&lt;/label&gt;<br>
                    &lt;input id="name" type="text"&gt;
                </code>
            </div>
        `
    };

    // Find matching suggestion
    for (const [key, suggestion] of Object.entries(suggestions)) {
        if (message.toLowerCase().includes(key)) {
            return suggestion;
        }
    }

    return ''; // Return empty string if no matching suggestion found
}
