import os
d = 'frontend/src/components'
for f in os.listdir(d):
    if f.endswith('.jsx'):
        p = os.path.join(d, f)
        with open(p, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Replace '' with 'https://stockoracle.duckdns.org'
        new_content = content.replace("import.meta.env.VITE_API_URL || ''", "import.meta.env.VITE_API_URL || 'https://stockoracle.duckdns.org'")
        
        if new_content != content:
            with open(p, 'w', encoding='utf-8') as file:
                file.write(new_content)
            print(f"Updated {f}")
