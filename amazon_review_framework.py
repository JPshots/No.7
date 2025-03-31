import os
import base64
from anthropic import Anthropic

# Initialize the Anthropic client with your API key
client = Anthropic(api_key="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")

def encode_image(image_path):
    """Encode an image file to base64."""
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_image_files():
    """Get all image files from the images folder."""
    image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
    image_files = []
    
    if os.path.exists('images'):
        for file in os.listdir('images'):
            if any(file.lower().endswith(ext) for ext in image_extensions):
                image_files.append(os.path.join('images', file))
    
    return image_files

def create_amazon_review():
    # Get the initial review from the user
    print("\n=== AMAZON REVIEW FRAMEWORK ===")
    print("\nPlease enter your initial product experience/review:")
    initial_review = input("> ")
    
    # Get all images from the images folder
    image_files = get_image_files()
    
    # Create the system prompt
    system_prompt = """
    You are an expert review assistant that helps transform product experiences into high-quality Amazon reviews.
    
    Use the Amazon Review Framework to guide this process. The framework consists of:
    1. Analyzing the initial review and any provided product images
    2. Asking targeted questions to gather missing context
    3. Creating an enhanced draft based on the gathered information
    4. Refining the review based on user feedback
    
    IMPORTANT: You MUST follow these steps in order. After analyzing the initial review and images, 
    ask questions to gather more information BEFORE creating any draft.
    
    When analyzing images, use your judgment to identify important product aspects that could enhance the review.
    Consider how the images complement or contradict the written review, and what additional insights they provide.
    """
    
    # Create the first message with review text and images
    first_message_content = f"Here is my initial product review:\n\n{initial_review}\n\n"
    
    # Add images to the message
    image_content = []
    if image_files:
        first_message_content += "I'm also sharing some images of the product for your analysis:\n"
        
        for image_path in image_files:
            image_base64 = encode_image(image_path)
            image_content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": f"image/{os.path.splitext(image_path)[1][1:]}",
                    "data": image_base64
                }
            })
    
    # First message to Claude
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": first_message_content}
        ] + image_content
    }]
    
    # Start the conversation loop
    print("\nStarting conversation with Claude. Type 'exit' to end the session.")
    
    conversation_active = True
    while conversation_active:
        # Send the current messages to Claude
        response = client.messages.create(
            model="claude-3-7-sonnet-20250219",
            system=system_prompt,
            messages=messages,
            max_tokens=4000
        )
        
        # Get Claude's response
        assistant_message = response.content[0].text
        print(f"\nClaude: {assistant_message}")
        
        # Add Claude's response to the messages
        messages.append({
            "role": "assistant",
            "content": assistant_message
        })
        
        # Get user response
        print("\nYou (type 'exit' to end): ")
        user_response = input("> ")
        
        if user_response.lower() == 'exit':
            # Save the conversation
            with open("amazon_review_conversation.txt", "w") as f:
                for message in messages:
                    if isinstance(message['content'], str):
                        f.write(f"{message['role'].upper()}: {message['content']}\n\n")
                    else:
                        # Handle the case where content is a list (for messages with images)
                        text_parts = [item['text'] for item in message['content'] if item['type'] == 'text']
                        f.write(f"{message['role'].upper()}: {''.join(text_parts)}\n\n")
            
            print("\nConversation saved to 'amazon_review_conversation.txt'")
            conversation_active = False
        else:
            # Add user response to messages
            messages.append({
                "role": "user",
                "content": user_response
            })

if __name__ == "__main__":
    create_amazon_review()