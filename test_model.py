from google import genai
from google.genai import types
import json, os

for line in open('.env'):
    if line.startswith('GEMINI_API_KEY'):
        key = line.split('=',1)[1].strip().strip('"')
        break

client = genai.Client(api_key=key)
resp = client.models.generate_content(
    model='gemini-flash-lite-latest',
    contents='Give 5 English COCA top words with Polish translations. JSON array: [{"rank":1,"word":"the","translation":"rodzajnik"}]',
    config=types.GenerateContentConfig(max_output_tokens=500, response_mime_type='application/json')
)
print('OK:', resp.text[:300])
