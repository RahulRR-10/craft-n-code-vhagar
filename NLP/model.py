import pandas as pd
from transformers import DistilBertTokenizer, DistilBertForSequenceClassification
from torch.optim import AdamW
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from torch.utils.data import DataLoader, TensorDataset
import torch
from sklearn.metrics import classification_report

# Load the dataset
data = pd.read_csv('products.csv')

# Combine relevant columns to create a single text input
data['text'] = (
    data['product_name'].fillna('') + " " +
    data['brand'].fillna('') + " " +
    data['nutritional_info'].fillna('') + " " +
    data['expiration_date'].fillna('') + " " +
    data['regulatory_notes'].fillna('')
)

# Preprocess the combined text
def preprocess_text(text):
    if isinstance(text, str):  # Check if the input is a string
        text = text.lower()    # Convert to lowercase
        # Additional preprocessing steps can be added here
    else:
        text = ""  # Assign an empty string or handle it as needed
    return text

data['text'] = data['text'].apply(preprocess_text)

# Encode labels
label_encoder = LabelEncoder()
data['label'] = label_encoder.fit_transform(data['label'])

# Split the dataset into features and labels
X = data['text']
y = data['label']

# Tokenization
tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
inputs = tokenizer(X.tolist(), padding=True, truncation=True, return_tensors="pt")

# Create attention masks
attention_masks = inputs['attention_mask']

# Split the data into training and testing sets
X_train, X_test, y_train, y_test, masks_train, masks_test = train_test_split(
    inputs['input_ids'], y, attention_masks, test_size=0.2, random_state=42
)

# Create DataLoader for the training set
train_data = TensorDataset(X_train, masks_train, torch.tensor(y_train.values, dtype=torch.long))
train_loader = DataLoader(train_data, batch_size=8, shuffle=True)

# Load pre-trained model
model = DistilBertForSequenceClassification.from_pretrained("distilbert-base-uncased", num_labels=len(label_encoder.classes_))

# Set up the optimizer
optimizer = AdamW(model.parameters(), lr=5e-5)

# Training loop
model.train()
for epoch in range(4):  # Adjust the number of epochs as needed
    total_loss = 0
    for batch in train_loader:
        batch_input_ids, batch_attention_mask, batch_labels = batch
        optimizer.zero_grad()
        outputs = model(batch_input_ids, attention_mask=batch_attention_mask, labels=batch_labels)
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item()
    
    avg_loss = total_loss / len(train_loader)
    print(f'Epoch {epoch + 1} completed. Average Loss: {avg_loss:.4f}')

# Create DataLoader for the test set
test_data = TensorDataset(X_test, masks_test, torch.tensor(y_test.values, dtype=torch.long))
test_loader = DataLoader(test_data, batch_size=8)

# Evaluation loop
model.eval()
predictions = []
with torch.no_grad():
    for batch in test_loader:
        batch_input_ids, batch_attention_mask, _ = batch
        outputs = model(batch_input_ids, attention_mask=batch_attention_mask)
        logits = outputs.logits
        preds = torch.argmax(logits, dim=1)
        predictions.extend(preds.numpy())

# Check class distribution
print("Training set class distribution:")
print(y_train.value_counts())

print("\nTest set class distribution:")
print(y_test.value_counts())

# Generate classification report
print(classification_report(y_test, predictions, zero_division=0))

# Assuming 'model' is your trained DistilBERT model and 'tokenizer' is your tokenizer

# Save the model to a directory
model.save_pretrained("compliance_doc_model")

# Save the tokenizer
tokenizer.save_pretrained("compliance_doc_model")

