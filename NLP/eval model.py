import pandas as pd
import torch
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from torch.utils.data import DataLoader, TensorDataset

# Load the trained model and tokenizer
model = DistilBertForSequenceClassification.from_pretrained('./compliance_doc_model')
tokenizer = DistilBertTokenizer.from_pretrained('./compliance_doc_model')  # Use the saved tokenizer

# Load the dataset (which doesn't have labels in this case)
data = pd.read_csv('food_compliance_data.csv')

# Combine relevant columns to create a single text input as done before
data['text'] = (
    data['product_name'].fillna('') + " " +
    data['brand'].fillna('') + " " +
    data['nutritional_info'].fillna('') + " " +
    data['expiration_date'].fillna('') + " " +
    data['regulatory_notes'].fillna('')
)

# Preprocess the text (lowercase the text)
def preprocess_text(text):
    if isinstance(text, str):
        return text.lower()
    return ""

data['text'] = data['text'].apply(preprocess_text)

# Tokenize the text data
inputs = tokenizer(data['text'].tolist(), padding=True, truncation=True, return_tensors="pt")

# Split the data into features (X) and attention masks
X = inputs['input_ids']
attention_masks = inputs['attention_mask']

# Create DataLoader for the test set (unlabeled)
test_data = TensorDataset(X, attention_masks)
test_loader = DataLoader(test_data, batch_size=8)

# Move the model to evaluation mode
model.eval()

# Evaluate the model on the test data (inference)
predictions = []
with torch.no_grad():
    for batch in test_loader:
        batch_input_ids, batch_attention_mask = batch
        outputs = model(batch_input_ids, attention_mask=batch_attention_mask)
        logits = outputs.logits
        preds = torch.argmax(logits, dim=1)
        predictions.extend(preds.numpy())

# Output the predictions
# Assuming 1 is 'compliant' and 0 is 'not compliant'
predictions_mapped = ['compliant' if pred == 1 else 'not compliant' for pred in predictions]

# Combine the predictions with the original data
data['predictions'] = predictions_mapped

# Display the first few rows to verify
print(data[['text', 'predictions']].head())

# Optionally, you can save the output to a CSV file
data[['text', 'predictions']].to_csv('compliance_predictions.csv', index=False)
