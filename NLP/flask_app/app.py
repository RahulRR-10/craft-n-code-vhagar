from flask import Flask, request, jsonify
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from flask_cors import CORS
PORT = 3157
# Load the trained model and tokenizer
model = DistilBertForSequenceClassification.from_pretrained('../compliance_doc_model')
tokenizer = DistilBertTokenizer.from_pretrained('../compliance_doc_model')

app = Flask(__name__)
CORS(app)

@app.route('/', methods=['GET'])
def main():
    return jsonify({'success': '0'}), 200


@app.route('/predict', methods=['POST'])
def predict():
    # Get JSON data from the request
    data = request.get_json(force=True)
    print(data)
    # Expecting a list of products
    if 'products' not in data:
        return jsonify({'error': 'No products found in the request'}), 400

    # Prepare the input data
    products = data['products']
    if not isinstance(products, list):
        return jsonify({'error': 'Products should be a list'}), 400

    # Create text input from the products
    text_inputs = []
    for product in products:
        text_input = (
            product.get('product_name', '') + " " +
            product.get('brand', '') + " " +
            product.get('nutritional_info', '') + " " +
            product.get('expiration_date', '') + " " +
            product.get('regulatory_notes', '')
        )
        text_inputs.append(text_input.lower())  # Lowercase the text

    # Tokenize the text data
    inputs = tokenizer(text_inputs, padding=True, truncation=True, return_tensors="pt")

    # Move model to evaluation mode
    model.eval()

    # Make predictions
    with torch.no_grad():
        outputs = model(inputs['input_ids'], attention_mask=inputs['attention_mask'])
        logits = outputs.logits
        preds = torch.argmax(logits, dim=1).numpy()

    # Map predictions to labels
    predictions_mapped = ['compliant' if pred == 1 else 'not compliant' for pred in preds]

    # Return predictions as JSON
    return jsonify(predictions=predictions_mapped)

if __name__ == '__main__':
    # Print a message indicating the app is running
    print("Starting Flask app...")
    print(f"App is running at http://0.0.0.0:{PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=True)

