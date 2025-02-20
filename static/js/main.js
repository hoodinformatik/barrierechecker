document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('checkForm');
    const urlInput = document.getElementById('urlInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const results = document.getElementById('results');
    const issuesList = document.getElementById('issuesList');
    const summary = document.getElementById('summary').querySelector('.alert');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Reset UI
        results.classList.add('d-none');
        loadingIndicator.classList.remove('d-none');
        issuesList.innerHTML = '';
        
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
            
            // Display results
            data.issues.forEach(issue => {
                const item = document.createElement('div');
                item.className = `list-group-item ${issue.type}`;
                
                item.innerHTML = `
                    <div class="d-flex align-items-center">
                        <div class="flex-shrink-0">
                            <i class="fas fa-${issue.type === 'error' ? 'times-circle text-danger' : 'exclamation-triangle text-warning'} fa-lg"></i>
                        </div>
                        <div class="flex-grow-1 ms-3">
                            <h5 class="mb-1">${issue.message}</h5>
                            <p class="mb-0 text-muted"><small>${issue.element}</small></p>
                        </div>
                    </div>
                `;
                
                issuesList.appendChild(item);
            });
            
            // Update summary
            let alertClass, summaryMessage;
            if (data.total_issues === 0) {
                alertClass = 'alert-success';
                summaryMessage = '<i class="fas fa-check-circle me-2"></i>Glückwunsch! Keine Barrierefreiheitsprobleme gefunden.';
            } else if (data.total_issues <= 3) {
                alertClass = 'alert-warning';
                summaryMessage = `<i class="fas fa-exclamation-circle me-2"></i>${data.total_issues} leichte Probleme gefunden.`;
            } else {
                alertClass = 'alert-danger';
                summaryMessage = `<i class="fas fa-times-circle me-2"></i>${data.total_issues} Probleme gefunden.`;
            }
            
            summary.className = `alert ${alertClass}`;
            summary.innerHTML = summaryMessage;
            
        } catch (error) {
            summary.className = 'alert alert-danger';
            summary.innerHTML = `<i class="fas fa-times-circle me-2"></i>${error.message}`;
            issuesList.innerHTML = '';
        }
        
        // Show results
        loadingIndicator.classList.add('d-none');
        results.classList.remove('d-none');
    });
});
