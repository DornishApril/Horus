# Horus - Screenshot Automation Server

A Node.js server for capturing screenshots of web pages using headless browser automation.

## Features

- Start and manage development servers for React/Next.js applications
- Capture screenshots of web pages with various options
- Support for full-page screenshots or specific elements
- Batch processing of multiple URLs
- RESTful API for easy integration
- Configurable viewport sizes and device emulation

## Prerequisites

- Node.js 16.x or higher
- npm or yarn
- Puppeteer (will be installed automatically)

## Installation

1. Clone the repository
   ```bash
   git clone <repository-url>
   cd horus
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Create a `.env` file (use `.env.example` as a template)
   ```bash
   cp .env.example .env
   ```

4. Start the server
   ```bash
   npm start
   # or for development with auto-reload
   npm run dev
   ```

## Configuration

Edit the `.env` file to configure the server:

```
SERVER_PORT=4000
DEFAULT_APP_PORT=3000
SCREENSHOT_DIR=./screenshots
BROWSER_TIMEOUT=30000
SERVER_TIMEOUT=60000
NODE_ENV=development
```

## API Endpoints

### Process Management

- `POST /api/process/start` - Start a development server
  ```json
  {
    "projectPath": "/path/to/your/project",
    "port": 3000,
    "env": {
      "NODE_ENV": "development"
    }
  }
  ```

- `POST /api/process/stop/:processId` - Stop a running process
- `GET /api/process` - List all running processes

### Screenshots

- `POST /api/screenshot` - Capture a screenshot
  ```json
  {
    "url": "http://localhost:3000",
    "options": {
      "fullPage": true,
      "viewport": {
        "width": 1920,
        "height": 1080
      },
      "selector": "#element-id",
      "waitForSelector": ".loaded",
      "waitForTimeout": 2000,
      "format": "png",
      "quality": 80
    }
  }
  ```

- `POST /api/screenshot/batch` - Capture multiple screenshots
  ```json
  {
    "urls": ["http://example.com/page1", "http://example.com/page2"],
    "options": {
      "format": "jpeg"
    }
  }
  ```

- `GET /api/screenshot` - List all captured screenshots
- `GET /api/screenshot/:id` - Get info about a specific screenshot
- `GET /screenshots/:filename` - Access a screenshot file directly

## Usage Example

1. Start a development server:
   ```bash
   curl -X POST http://localhost:4000/api/process/start \
     -H "Content-Type: application/json" \
     -d '{"projectPath": "/path/to/your/nextjs/app"}'
   ```

2. Take a screenshot:
   ```bash
   curl -X POST http://localhost:4000/api/screenshot \
     -H "Content-Type: application/json" \
     -d '{"url": "http://localhost:3000"}'
   ```

## Development

- Run the server in development mode:
  ```bash
  npm run dev
  ```

- Run tests (when available):
  ```bash
  npm test
  ```

## License

MIT

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request
