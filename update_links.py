#!/usr/bin/env python3
import re

# Read the file
file_path = 'app/views/v4-apply/add-more-actions3.html'
with open(file_path, 'r') as f:
    content = f.read()

# Function to replace Change links with proper anchors
def replace_change_link(match):
    parcel = match.group(1)
    # Replace space with hyphen for the anchor
    anchor = parcel.replace(' ', '-')
    return f'<td class="govuk-table__cell">{parcel}</td>{match.group(2)}<a class="govuk-link" href="add-area3#{anchor}">Change</a>'

# Pattern to match table rows with parcel numbers and Change links (with current add-area or add-area3)
pattern = r'<td class="govuk-table__cell">(SO3757 \d+)</td>(.*?)<a class="govuk-link" href="add-area3?#[^"]*">Change</a>'

# Replace all occurrences
updated_content = re.sub(pattern, replace_change_link, content, flags=re.DOTALL)

# Write back to file
with open(file_path, 'w') as f:
    f.write(updated_content)

print("Successfully updated all Change links!")
