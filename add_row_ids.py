#!/usr/bin/env python3
import re

# Read the file
file_path = 'app/views/v4-apply/add-area3.html'
with open(file_path, 'r') as f:
    content = f.read()

# Function to add ID to table rows
def add_row_id(match):
    parcel_full = match.group(1)  # e.g., "SO3757 3159"
    parcel_id = parcel_full.replace(' ', '-')  # Convert to "SO3757-3159"
    return f'<tr class="govuk-table__row" id="{parcel_id}">'

# Pattern to match table rows followed by cells containing parcel numbers
# We need to find <tr> tags and add id attribute based on the parcel number in the row
pattern = r'<tr class="govuk-table__row">(\s+<td class="govuk-table__cell"[^>]*>.*?</td>\s+<td class="govuk-table__cell"[^>]*>(SO3757 \d+)</td>)'

def add_id_to_row(match):
    full_match = match.group(0)
    parcel_full = match.group(2)  # e.g., "SO3757 3159"
    parcel_id = parcel_full.replace(' ', '-')  # Convert to "SO3757-3159"
    
    # Replace the opening <tr> tag with one that has an id
    return full_match.replace('<tr class="govuk-table__row">', f'<tr class="govuk-table__row" id="{parcel_id}">')

# Replace all occurrences
updated_content = re.sub(pattern, add_id_to_row, content, flags=re.DOTALL)

# Write back to file
with open(file_path, 'w') as f:
    f.write(updated_content)

print("Successfully added IDs to all table rows!")
