python-service/
├── main.py                  # FastAPI app with /generate-template endpoint
├── requirements.txt
├── services/
│   ├── __init__.py
│   ├── pdf_processor.py     # PDF → page images via PyMuPDF
│   ├── gemini_service.py    # Gemini Vision API client
│   ├── question_parser.py   # Parse Gemini JSON response
│   └── template_builder.py  # Merge pages → final template
└── utils/
    ├── __init__.py
    └── logger.py            # Logging helpers