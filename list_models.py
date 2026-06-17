from google import genai
import os

for line in open('.env'):
    if line.startswith('GEMINI_API_KEY'):
        key = line.split('=',1)[1].strip().strip('"')
        break

client = genai.Client(api_key=key)
print('Dostepne modele Gemini (z generateContent):')
for m in client.models.list():
    if 'generate' in str(m.supported_actions):
        print(f'  {m.name}')
