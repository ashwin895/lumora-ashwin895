# Lumora v2

A free, thoughtful AI assistant website created by ASHWIN.

## What works now

- Start animation, name prompt, and a personal greeting
- Peaceful home screen that shifts to a focused chat palette when you start typing
- Streaming replies with Stop, Copy, Read-aloud, and code blocks with Copy
- Conversation history in the sidebar: open, delete, new chat (Ctrl/Cmd+K)
- Preferences: response length, explanation level, read replies aloud
- Memory you control: add, edit, delete, and turn memory use on or off
- Attachments: images (understood by a vision model) and text, Markdown, CSV, JSON, or code files
- Voice input (browser speech recognition, where supported)
- Your data: export everything as JSON, export a chat as Markdown, or delete everything
- Security: API key kept on the server, input limits, rate limiting, strict Content-Security-Policy
- Accessibility: keyboard navigation, screen-reader live region, focus outlines, reduced-motion support
- Search-ready: metadata, Open Graph tags, and structured data

## Run locally

Requires Node.js 18.17 or newer.

```bash
cp .env.example .env     # then add your free provider key
npm install
npm test                 # runs the tests
npm start                # open http://localhost:3000
```

## Free hosting

1. Create a free key at a provider such as Groq (see `.env.example`).
2. Push the project to GitHub, keeping `.env` out of the repository.
3. Create a free Render Web Service from the repo. Build: `npm install`. Start: `npm start`.
4. Enter `API_KEY`, `BASE_URL`, `MODEL`, and `VISION_MODEL` in the Render dashboard.
5. Replace `www.your-domain.com` in `public/index.html`, then add `robots.txt` and `sitemap.xml`.

Free tiers have request limits and free services may sleep when idle.

## Not included yet

These need paid or heavy services, or more build time:

- PDF, Word, PowerPoint, and Excel reading
- Live web search with citations
- Image, audio, and video generation or video analysis
- User accounts and cloud sync (today all data stays in the browser)
- Native mobile apps
- Automated evaluation and error monitoring beyond the tests

## Privacy notes

Chats and memories are stored only in the browser's local storage. The server does not save conversations, but the AI provider processes each message to produce a reply, so check the provider's data policy before launch.
