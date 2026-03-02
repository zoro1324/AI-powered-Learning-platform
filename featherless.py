from openai import OpenAI

client = OpenAI(
  base_url="https://api.featherless.ai/v1",
  api_key="rc_6bdec714a5472544d86aaf5ecc86a2288a1add676911c5f14a22a775299a085e",
)

response = client.chat.completions.create(
  model='gpt-oss-120b',
  messages=[
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
)
print(response.choices[0].message.content)