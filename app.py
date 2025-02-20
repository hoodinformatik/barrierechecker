from flask import Flask, render_template, request, jsonify
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse
import re
from wcag_contrast_ratio import rgb
import html5lib
import json
import logging

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)

def is_valid_url(url):
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc]) and result.scheme in ['http', 'https']
    except:
        return False

def check_color_contrast(color1, color2):
    try:
        # Convert hex to RGB
        def hex_to_rgb(hex_color):
            hex_color = hex_color.lstrip('#')
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

        if color1.startswith('#') and color2.startswith('#'):
            rgb1 = hex_to_rgb(color1)
            rgb2 = hex_to_rgb(color2)
            contrast = rgb(rgb1, rgb2)
            return contrast >= 4.5  # WCAG AA standard for normal text
        return True
    except:
        return True

def check_accessibility(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html5lib')
        issues = []
        
        # 1. Check images for alt text
        images = soup.find_all('img')
        for img in images:
            if not img.get('alt'):
                issues.append({
                    'type': 'error',
                    'message': 'Bild ohne Alt-Text gefunden',
                    'element': str(img)[:100] + '...' if len(str(img)) > 100 else str(img)
                })
            elif len(img['alt'].strip()) < 5:
                issues.append({
                    'type': 'warning',
                    'message': 'Bild mit sehr kurzem Alt-Text gefunden',
                    'element': str(img)[:100] + '...' if len(str(img)) > 100 else str(img)
                })

        # 2. Check heading hierarchy
        headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
        prev_level = 0
        h1_count = 0
        for heading in headings:
            current_level = int(heading.name[1])
            if current_level == 1:
                h1_count += 1
            if current_level > prev_level + 1:
                issues.append({
                    'type': 'error',
                    'message': f'Überschriften-Hierarchie übersprungen (von H{prev_level} zu H{current_level})',
                    'element': heading.text
                })
            prev_level = current_level

        if h1_count == 0:
            issues.append({
                'type': 'error',
                'message': 'Keine H1-Überschrift gefunden',
                'element': 'Dokument'
            })
        elif h1_count > 1:
            issues.append({
                'type': 'warning',
                'message': 'Mehrere H1-Überschriften gefunden',
                'element': 'Dokument'
            })

        # 3. Check ARIA labels and roles
        interactive_elements = soup.find_all(['button', 'a', 'input', 'select', 'textarea'])
        for element in interactive_elements:
            if not (element.get('aria-label') or element.get('aria-labelledby')):
                if element.name == 'a' and element.get('href') and not element.text.strip():
                    issues.append({
                        'type': 'error',
                        'message': 'Link ohne Text oder ARIA-Label gefunden',
                        'element': str(element)[:100] + '...' if len(str(element)) > 100 else str(element)
                    })
                elif element.name in ['button', 'input'] and not element.get('value', '').strip():
                    issues.append({
                        'type': 'warning',
                        'message': f'{element.name.capitalize()} ohne ARIA-Label gefunden',
                        'element': str(element)[:100] + '...' if len(str(element)) > 100 else str(element)
                    })

        # 4. Check form elements
        forms = soup.find_all('input')
        for form_element in forms:
            if form_element.get('type') not in ['submit', 'button', 'hidden', 'image']:
                if not form_element.get('id') or not soup.find('label', attrs={'for': form_element.get('id')}):
                    issues.append({
                        'type': 'error',
                        'message': 'Formularelement ohne zugehöriges Label',
                        'element': str(form_element)[:100] + '...' if len(str(form_element)) > 100 else str(form_element)
                    })

        # 5. Check language declaration
        if not soup.html.get('lang'):
            issues.append({
                'type': 'error',
                'message': 'Keine Sprach-Deklaration im HTML-Tag gefunden',
                'element': '<html> Tag'
            })

        # 6. Check table accessibility
        tables = soup.find_all('table')
        for table in tables:
            if not table.find('th'):
                issues.append({
                    'type': 'warning',
                    'message': 'Tabelle ohne Überschriften gefunden',
                    'element': str(table)[:100] + '...' if len(str(table)) > 100 else str(table)
                })

        # 7. Check for proper list markup
        lists = soup.find_all(['ul', 'ol'])
        for list_element in lists:
            if not list_element.find_all('li'):
                issues.append({
                    'type': 'error',
                    'message': 'Liste ohne Listenelemente gefunden',
                    'element': str(list_element)[:100] + '...' if len(str(list_element)) > 100 else str(list_element)
                })

        # 8. Check for skip links
        if not soup.find('a', href='#main') and not soup.find('a', href='#content'):
            issues.append({
                'type': 'warning',
                'message': 'Kein Skip-Link zum Hauptinhalt gefunden',
                'element': 'Navigation'
            })

        # 9. Check for viewport meta tag
        if not soup.find('meta', attrs={'name': 'viewport'}):
            issues.append({
                'type': 'warning',
                'message': 'Kein Viewport Meta-Tag für responsive Design gefunden',
                'element': '<head> Tag'
            })

        return {
            'success': True,
            'issues': issues,
            'total_issues': len(issues)
        }
    except Exception as e:
        logging.error(f"Error checking accessibility: {str(e)}")
        return {
            'success': False,
            'error': f'Fehler beim Überprüfen der URL: {str(e)}'
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
