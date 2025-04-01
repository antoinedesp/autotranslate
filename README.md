# AutoTranslate

A command-line tool to translate JSON and INI files using LibreTranslate.

## Installation

```bash
npm install
npm run build
```

## Usage

The tool supports translating both JSON and INI files using LibreTranslate. You need to specify the LibreTranslate server URL and the target language.

### Basic Usage

```bash
# Translate a JSON file
npm start -- --json --libretranslate-url="http://localhost:5000" --to="fr" path/to/file.json

# Translate an INI file
npm start -- --ini --libretranslate-url="http://localhost:5000" --to="es" path/to/file.ini

# Specify source language (optional, defaults to "auto")
npm start -- --json --libretranslate-url="http://localhost:5000" --from="en" --to="de" path/to/file.json
```

### Parameters

- `--json` or `--ini`: Specify the file format (required)
- `--libretranslate-url <url>`: URL of the LibreTranslate API server (required)
- `--to <lang>`: Target language code (required)
- `--from <lang>`: Source language code (optional, defaults to "auto")
- `<file>`: Path to the file to translate

### Output

The translated file will be saved in the same directory as the input file with "\_translated" appended to the filename.

For example:

- `example.json` → `example_translated.json`
- `config.ini` → `config_translated.ini`

## Supported Languages

The supported languages depend on your LibreTranslate instance. Common language codes include:

- en (English)
- fr (French)
- es (Spanish)
- de (German)
- it (Italian)
- pt (Portuguese)
- ru (Russian)
- ja (Japanese)
- zh (Chinese)
