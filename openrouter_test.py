import os
from openai import OpenAI

# OpenRouter uses the OpenAI SDK format
client = OpenAI(
  base_url="https://openrouter.ai/api/v1",
  api_key=os.getenv("OPENROUTER_API_KEY", ""),
)

response = client.chat.completions.create(
  model='openai/gpt-3.5-turbo',
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello! How are you doing today?"}
  ],
)
print(response.choices[0].message.content)
