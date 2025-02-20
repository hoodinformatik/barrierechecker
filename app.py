from flask import Flask, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
from wcag_contrast_ratio import rgb

app = Flask(__name__)

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except:
        return False

def check_accessibility(url):
    try:
        response = requests.get(url)
        soup = BeautifulSoup(response.text, 'html5lib')
        issues = []
        
        # Prüfe Alt-Text für Bilder
        images = soup.find_all('img')
        for img in images:
            if not img.get('alt'):
                issues.append({
                    'type': 'error',
                    'message': 'Bild ohne Alt-Text gefunden',
                    'element': str(img)[:100] + '...'
                })

        # Prüfe Überschriften-Hierarchie
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        prev_level = 0
        for heading in headings:
            current_level = int(heading.name[1])
            if current_level > prev_level + 1:
                issues.append({
                    'type': 'warning',
                    'message': f'Überschriften-Hierarchie übersprungen (von H{prev_level} zu H{current_level})',
                    'element': heading.text
                })
            prev_level = current_level

        # Prüfe ARIA-Labels
        interactive_elements = soup.find_all(['button', 'a', 'input', 'select'])
        for element in interactive_elements:
            if not (element.get('aria-label') or element.get('aria-labelledby')):
                issues.append({
                    'type': 'warning',
                    'message': 'Interaktives Element ohne ARIA-Label',
                    'element': str(element)[:100] + '...'
                })

        # Prüfe Formular-Labels
        forms = soup.find_all('input')
        for form_element in forms:
            if form_element.get('type') not in ['submit', 'button', 'hidden']:
                if not form_element.get('id') or not soup.find('label', attrs={'for': form_element.get('id')}):
                    issues.append({
                        'type': 'error',
                        'message': 'Formularelement ohne zugehöriges Label',
                        'element': str(form_element)[:100] + '...'
                    })

        return {
            'success': True,
            'issues': issues,
            'total_issues': len(issues)
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/check', methods=['POST'])
def check():
    url = request.json.get('url', '')
    
    if not is_valid_url(url):
        return jsonify({
            'success': False,
            'error': 'Ungültige URL. Bitte geben Sie eine gültige URL ein (z.B. https://example.com)'
        })
    
    return jsonify(check_accessibility(url))

if __name__ == '__main__':
    app.run(debug=True)
