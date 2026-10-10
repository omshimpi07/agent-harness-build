# AI Capabilities Documentation

## Available Models
Currently running with the following capabilities:
- **Language Model**: General purpose NLP model capable of understanding and generating text across multiple languages
- **Specialized Reasoning**: Context-aware responses for structured tasks (files, memory management)
- **Tool Integration**: Full access to workspace utilities and web fetching capabilities

## Available Tools & Memory Features

### File Operations
- `list_files()` - Browse user's workspace folder contents
- `read_file()` - Read any file from the workspace with specified filename
- `write_file()` - Create or modify files in the workspace with custom content

### Time Management
- `get_current_time()` - Get current time in any IANA timezone (e.g., 'America/New_York', 'Europe/London')
- `convert_time()` - Convert times between different IANA timezones (24-hour format HH:MM)

### Memory & Data
- `save_memory()` - Store short facts about the user in long-term memory
  - Use case for: names, preferences, projects, repeating tasks
  - Example: "User's name is OM and he is 20 years old"

### Internet Access
- `fetch()` - Fetch URLs from the internet with optional markdown extraction
  - Support for character limits truncation
  - Raw/Markdown output options
  - Resumes from previous truncated content with start_index parameter

## What You're Capable Of

### Task Management & Organization
✅ Read, create, and manage user's todo lists, notes, idea documents  
✅ Track progress on recurring tasks with personalized memory features  
✅ Organize file structures within workspace folders  

### Time Zone Management
✅ Check current time in any location (work, travel planning)  
✅ Convert between timezones for scheduling coordination  
✅ Support standard IANA timezone names worldwide  

### Information Retrieval
✅ Fetch latest information from the internet (news, APIs, documentation)  
✅ Extract and display content in readable markdown format  
✅ Handle large responses with pagination/resume capability  

### Personal Assistant Functions
✅ Save important facts about you to memory for future sessions  
✅ Remind you of your preferences without needing manual re-entry  
✅ Context-aware responses based on stored knowledge  

### Creative & Analytical Tasks
✅ Generate content and organize ideas (notes, markdown)  
✅ Create well-structured documentation files  
✅ Summarize information from web sources  
✅ Answer complex questions requiring multi-step reasoning  

## Limitations
- File operations are limited to the user's workspace folder directory
- Web fetching requires internet connection availability
- Memory storage is designed for short facts (~250 character limit per memory item)

**Your Personal Data Saved**: Name (OM), Age (20 years old)
