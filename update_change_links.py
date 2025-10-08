#!/usr/bin/env python3
import re

# Read the file
file_path = 'app/views/v4-apply/add-more-actions.html'
with open(file_path, 'r') as f:
    content = f.read()

# Replace all Change links that have href="add-area#..." with href="../_common/not-testing"
# Pattern matches: href="add-area#SO3757-XXXX">Change</a>
pattern = r'href="add-area#[^"]*">Change</a>'
replacement = 'href="../_common/not-testing">Change</a>'

updated_content = re.sub(pattern, replacement, content)

# Write back to file
with open(file_path, 'w') as f:
    f.write(updated_content)

print("Successfully updated all Change links!")
