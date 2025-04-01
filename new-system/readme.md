# Amazon Review Framework CLI Tool

A command-line tool for creating exceptional product reviews using the Amazon Review Framework. This tool guides you through a structured process to create high-quality product reviews that could help qualify for the Amazon Vine program.

## Features

- **Structured Review Process**: Guides you through a four-phase review creation process
- **Image Support**: Analyze product images for a more comprehensive review
- **Session Management**: Save and resume review sessions at any time
- **Quality Assessment**: Ensure your reviews meet high-quality standards
- **Formatted Output**: Export finalized reviews as Markdown files

## Installation

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (comes with Node.js)
- Claude API key from Anthropic

### Setup

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/amazon-review-framework-cli.git
   cd amazon-review-framework-cli
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Create a `.env` file in the project root with your Anthropic API key:
   ```
   ANTHROPIC_API_KEY=sk-ant-api03-your-api-key
   ```

4. Make the CLI executable:
   ```
   chmod +x amazon-review.js
   ```

## Usage

### Starting the Tool

Run the tool with:

```
node amazon-review.js
```

Or if you made it executable:

```
./amazon-review.js
```

### Command-Line Options

- `--new`, `-n`: Start a new review session
- `--continue <id>`, `-c <id>`: Continue an existing review session
- `--list`, `-l`: List all saved review sessions
- `--directory <path>`, `-d <path>`: Set custom directory for images (default: ./images)
- `--verbose`, `-v`: Enable verbose output for debugging
- `--help`, `-h`: Display help information

### Interactive Menu

If you run without options, you'll see an interactive menu:

1. Start a new review
2. Continue an existing review
3. List saved reviews
4. Exit

### Review Process Phases

The tool guides you through four phases:

1. **Intake & Questioning**: Gathers information about your product experience
   - Answer questions about the product
   - Add images for analysis
   - Complete until all necessary information is gathered

2. **Draft Creation**: Creates a structured review based on your input
   - Generates a complete review draft
   - Applies appropriate structure and formatting
   - Balances information and personality

3. **Refinement**: Improves the review based on your feedback
   - Implement specific changes you request
   - Maintain framework compliance
   - Preserve authentic voice and experience

4. **Quality Control**: Finalizes the review to ensure high quality
   - Applies comprehensive quality assessment
   - Performs final polish
   - Exports the finalized review as a Markdown file

### Special Commands

While in a review session, you can use these commands:

- `exit`: Save the current session and exit
- `save`: Save the current session and continue

### Working with Images

Place product images in the `./images` directory before starting a new review. The tool will analyze these images during the Intake phase.

Supported image formats: JPG, JPEG, PNG, GIF, WebP, BMP

## Example Workflow

```
$ node amazon-review.js --new

Creating new review session...

=== INTAKE & QUESTIONING PHASE ===
In this phase, I'll gather information about your product experience.

Please describe your product experience (an editor will open for you to type your response):
[Editor opens for your input]

Found 2 images to analyze.

Processing your input...

Response:
Thank you for sharing your experience with the XYZ Wireless Headphones. I'd like to ask some questions to gather more information for the review.

1. How long have you been using these headphones?
2. What feature surprised you most compared to other headphones you've used?
...

[Continue answering questions until ready for draft]

=== DRAFT CREATION PHASE ===
In this phase, I'll create a complete review draft based on the information gathered.

Generating review draft...

Draft review:
[Complete review draft]

How would you like to proceed with this draft?
> Proceed to Refinement phase

=== REFINEMENT PHASE ===
In this phase, we'll improve the review based on your feedback.

[Provide feedback and improvements]

=== QUALITY CONTROL PHASE ===
In this phase, I'll finalize the review and ensure it meets all quality standards.

Final review:
[Finalized review with quality assessment]

The review process is complete. What would you like to do?
> Save and finish

Review process complete!
Final review saved to: reviews/xyz-wireless-headphones-2023-06-01.md
```

## File Structure

- `reviews/`: Contains exported review files
- `.sessions/`: Contains saved session data
- `images/`: Place product images here

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
