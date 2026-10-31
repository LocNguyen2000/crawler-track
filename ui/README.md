# spiderman-crawler UI

The UI is built with React and Vite.

## Setup

```sh
npm install
```

## Development

```sh
npm run dev
```

## Production build

```sh
npm run build
```

The crawler API is expected at `http://localhost:4000`.

## Run the full application with Docker

From the repository root, run `docker compose up --build`. Open the UI at
`http://localhost:8080`; the API is available at `http://localhost:4000`.
MongoDB data is stored in the `mongo-data` Docker volume. Stop the services with
`docker compose down`.
