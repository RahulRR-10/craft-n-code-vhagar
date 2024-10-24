import csv
import random
from datetime import datetime, timedelta

# List of products
products = ['Tomato', 'Apple', 'Banana', 'Bittergourd', 'Capsicum', 'Cucumber', 'Okra', 'Oranges', 'Potato', 'Pineapple']

# Regulatory bodies (can be none or more than one)
regulatory_bodies = ['FDA', 'EU', 'WHO', 'FSSAI', 'USDA']

# Predefined brand names (only 10)
brands = [f"Brand_{i}" for i in range(1, 11)]

# Function to generate random expiration dates
def generate_expiration_date():
    days = random.randint(-365, 365)  # Past year to next year
    return datetime.now() + timedelta(days=days)

# Function to generate compliance based on multiple factors
def determine_compliance(expiration_date, regulatory_notes, nutritional_info):
    # Extract nutrition info
    nutritional_data = {item.split(':')[0].strip(): int(item.split(':')[1].strip().split('g')[0]) 
                        for item in nutritional_info.split(', ')}
    
    # Criteria
    expired = expiration_date < datetime.now()
    regulatory_approval = 'None' not in regulatory_notes
    fat_acceptable = nutritional_data.get('Fat', 0) <= 5  # Maximum 5g of fat
    sugar_acceptable = nutritional_data.get('Sugar', 0) <= 22.5  # Maximum 22.5g of sugar
    
    # Non-compliant if expired, no approval, or exceeds fat/sugar limits
    if expired or not regulatory_approval or not fat_acceptable or not sugar_acceptable:
        return 0
    return 1

# Open CSV file
with open('food_compliance_data.csv', mode='w', newline='') as file:
    writer = csv.writer(file)

    # Write the header with lowercase column names and underscores
    writer.writerow(['product_name', 'brand', 'nutritional_info', 'expiration_date', 'regulatory_notes', 'label'])

    compliant_count = 100  # Number of compliant records
    non_compliant_count = 100  # Number of non-compliant records

    # Generate compliant records
    for _ in range(compliant_count):
        product = random.choice(products)
        brand = random.choice(brands)
        nutritional_info = f"Fat: {random.randint(0, 5)}g, Sugar: {random.randint(0, 5)}g"  # Low fat and sugar
        expiration_date = generate_expiration_date().strftime('%Y-%m-%d')

        # Ensure at least one regulatory body
        regulatory_notes = ', '.join(random.sample(regulatory_bodies, random.randint(1, len(regulatory_bodies)))) 
        label = determine_compliance(datetime.strptime(expiration_date, '%Y-%m-%d'), regulatory_notes, nutritional_info)

        # Write the row
        writer.writerow([product, brand, nutritional_info, expiration_date, regulatory_notes, label])

    # Generate non-compliant records
    for _ in range(non_compliant_count):
        product = random.choice(products)
        brand = random.choice(brands)
        nutritional_info = f"Fat: {random.randint(6, 20)}g, Sugar: {random.randint(6, 15)}g"  # High fat and sugar
        expiration_date = generate_expiration_date().strftime('%Y-%m-%d')

        # Randomly decide if there will be regulatory notes
        if random.random() < 0.5:  # 50% chance to include regulatory bodies
            regulatory_notes = ', '.join(random.sample(regulatory_bodies, random.randint(1, len(regulatory_bodies)))) 
        else:
            regulatory_notes = 'None'  # No regulatory approval
        
        # Ensure non-compliance
        label = determine_compliance(datetime.strptime(expiration_date, '%Y-%m-%d'), regulatory_notes, nutritional_info)

        # Write the row
        writer.writerow([product, brand, nutritional_info, expiration_date, regulatory_notes, label])

print("CSV file 'food_compliance_data.csv' with 200 records generated successfully.")
