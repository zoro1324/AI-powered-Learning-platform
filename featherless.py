import os

from openai import OpenAI

client = OpenAI(
  base_url="https://api.featherless.ai/v1",
  api_key=os.getenv("FEATHERLESS_API_KEY", ""),
)

response = client.chat.completions.create(
  model='openai/gpt-oss-120b',
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
)
print(response.choices[0].message.content)