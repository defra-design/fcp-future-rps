#!/usr/bin/env python3
import re

# Read the file
file_path = 'app/views/v4-apply/add-more-actions.html'
with open(file_path, 'r') as f:
    content = f.read()

# Replace all Remove links that have href="#" with href="../_common/not-testing"
updated_content = content.replace('href="#">Remove</a>', 'href="../_common/not-testing">Remove</a>')

# Write back to file
with open(file_path, 'w') as f:
    f.write(updated_content)

print("Successfully updated all Remove links!")
