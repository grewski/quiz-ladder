# Quiz Ladder

An interactive multiple choice quiz app inspired by TV quiz ladders. It is a static site, so it can be hosted on any basic web server.

## Run locally

```sh
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Do not open `index.html` directly from Finder. Browsers block local JSON loading from `file://`, so the quiz files need a local or hosted web server.

## Share a specific quiz

Each quiz can be opened directly with the `quiz` query parameter:

```text
http://localhost:4173/?quiz=kanban-guide
```

When hosted, use the same pattern with your public site URL.

## Deploy to GitHub Pages

Use GitHub Pages' branch deploy mode with the visible `docs` folder:

1. Upload the whole `docs` folder to your repository.
2. In GitHub, go to **Settings > Pages**.
3. Set **Build and deployment > Source** to **Deploy from a branch**.
4. Choose branch `main` and folder `/docs`.
5. Save.

## Add another quiz

1. Create a new JSON file in `quizzes/`.
2. Add an entry for it in `quizzes/index.json`.

Quiz file shape:

```json
{
  "id": "my-quiz",
  "title": "My Quiz",
  "description": "A short description.",
  "moneyLadder": ["$100", "$200", "$300"],
  "questions": [
    {
      "question": "Question text?",
      "answers": ["Answer A", "Answer B", "Answer C", "Answer D"],
      "correctIndex": 0,
      "explanation": "Optional explanation shown after answering."
    }
  ]
}
```

`correctIndex` is zero-based, so `0` is the first answer.
# quiz-ladder
