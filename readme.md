# Amazon Review Framework CLI

A command-line tool that helps create exceptional Amazon product reviews using Claude AI and the Amazon Review Framework.

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/amazon-review-framework.git
   cd amazon-review-framework
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up your API key**
   - Copy `.env.example` to a new file called `.env`
   - Add your Anthropic API key to the `.env` file:
     ```
     ANTHROPIC_API_KEY=your_api_key_here
     ```

4. **Add product images (optional)**
   - Place product images in the `images/` directory
   - Supported formats: jpg, jpeg, png, gif, webp, bmp

## Usage

Start the CLI tool:

```bash
npm start
```

### Commands

- `exit` - End the session and save the conversation
- `save` - Save the current conversation without exiting

## YAML Framework Files

The system uses YAML files from the `YAML/` directory to structure the review process:

- `framework-overview.yaml` - Master reference for the entire review system
- `review-strategy.yaml` - Goals, principles, and success metrics
- `question-framework.yaml` - Methods for gathering product information
- `personality-balance.yaml` - Guidelines for balancing information and personality
- `creative-techniques.yaml` - Approaches for enhancing reviews
- `content-structure.yaml` - Organization templates for review structures
- `formatting-and-style.yaml` - Visual presentation standards
- `keyword-strategy.yaml` - Techniques for incorporating search-optimized terms
- `quality-control.yaml` - Assessment frameworks for review excellence
- `writing-process.yaml` - Step-by-step workflow for review creation

## Notes on Security

- The `.env` file containing your API key is not committed to Git (it's in `.gitignore`)
- Make sure not to accidentally commit your API key to version control

## License

[MIT](LICENSE)