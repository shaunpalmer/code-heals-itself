# #!/usr/bin/env python3
# """Fix YAML regex escaping in taxonomy file."""
# import re
# import sys

# def fix_yaml_regex_escaping(content: str) -> str:
#     """Escape backslashes in double-quoted regex patterns."""
#     lines = content.split('\n')
#     fixed = []
#     in_regex_section = False
    
#     for line in lines:
#         stripped = line.lstrip()
        
#         # Track if we're in a regex section
#         if stripped.startswith('regex:'):
#             in_regex_section = True
#             fixed.append(line)
#             continue
        
#         # Exit regex section
#         if in_regex_section and stripped and not stripped.startswith('-') and not stripped.startswith('"'):
#             in_regex_section = False
        
#         # Fix regex lines
#         if in_regex_section and stripped.startswith('- "'):
#             # Extract the quoted content
#             match = re.match(r'(\s+- ")(.*)(")$', line)
#             if match:
#                 indent, pattern, quote = match.groups()
#                 # Double all backslashes
#                 fixed_pattern = pattern.replace('\\', '\\\\')
#                 fixed.append(f'{indent}{fixed_pattern}{quote}')
#                 continue
        
#         fixed.append(line)
    
#     return '\n'.join(fixed)

# if __name__ == '__main__':
#     yaml_path = 'rules/rebanker_taxonomy.yml'
    
#     with open(yaml_path, 'r', encoding='utf-8') as f:
#         content = f.read()
    
#     fixed_content = fix_yaml_regex_escaping(content)
    
#     with open(yaml_path, 'w', encoding='utf-8') as f:
#         f.write(fixed_content)
    
#     print(f"✅ Fixed regex escaping in {yaml_path}")
    
#     # Validate
#     import yaml
#     try:
#         with open(yaml_path, 'r', encoding='utf-8') as f:
#             yaml.safe_load(f)
#         print("✅ YAML is now valid")
#     except yaml.YAMLError as e:
#         print(f"❌ YAML still has errors: {e}")
#         sys.exit(1)
