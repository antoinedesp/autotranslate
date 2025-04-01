#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";

interface TranslateRequest {
  q: string;
  source: string;
  target: string;
}

interface IniLine {
  type: "section" | "key" | "comment" | "empty";
  content: string;
  key?: string;
  value?: string;
}

interface TranslatedContent {
  [section: string]: {
    [key: string]: string;
  };
}

const program = new Command();

program
  .name("autotranslate")
  .description("Translate JSON or INI file content using LibreTranslate")
  .requiredOption("--libretranslate-url <url>", "LibreTranslate API URL")
  .requiredOption("--to <lang>", "Target language code")
  .option("--from <lang>", "Source language code", "auto")
  .option("--json", "Process JSON file")
  .option("--ini", "Process INI file")
  .argument("<file>", "Path to the file to translate")
  .parse(process.argv);

const options = program.opts();

async function checkLibreTranslateAccess(url: string): Promise<boolean> {
  try {
    const response = await axios.get(url);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

async function translateText(
  text: string,
  from: string,
  to: string,
  apiUrl: string
): Promise<string> {
  try {
    const payload: TranslateRequest = {
      q: text,
      source: from,
      target: to,
    };

    console.log(`Translating text: ${text}`);
    const response = await axios.post(`${apiUrl}/translate`, payload);
    return response.data.translatedText;
  } catch (error) {
    console.error("Translation error:", error);
    throw error;
  }
}

function parseIniWithComments(content: string): IniLine[] {
  const lines = content.split("\n");
  const result: IniLine[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      result.push({ type: "empty", content: line });
      continue;
    }

    // Handle comments
    if (trimmedLine.startsWith(";") || trimmedLine.startsWith("#")) {
      result.push({ type: "comment", content: line });
      continue;
    }

    // Handle sections
    const sectionMatch = trimmedLine.match(/^\[(.*?)\]$/);
    if (sectionMatch) {
      result.push({ type: "section", content: line });
      continue;
    }

    // Handle key-value pairs
    const keyValueMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (keyValueMatch) {
      result.push({
        type: "key",
        content: line,
        key: keyValueMatch[1].trim(),
        value: keyValueMatch[2].trim(),
      });
      continue;
    }

    // Keep other lines as is
    result.push({ type: "key", content: line });
  }

  return result;
}

async function translateJsonValue(
  value: any,
  from: string,
  to: string,
  apiUrl: string
): Promise<any> {
  if (typeof value === "string") {
    if (value.trim()) {
      return await translateText(value, from, to, apiUrl);
    }
    return value;
  } else if (Array.isArray(value)) {
    return await Promise.all(
      value.map((item) => translateJsonValue(item, from, to, apiUrl))
    );
  } else if (value && typeof value === "object") {
    const result: any = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = await translateJsonValue(val, from, to, apiUrl);
    }
    return result;
  }
  return value;
}

async function processJsonFile(
  filePath: string,
  from: string,
  to: string,
  apiUrl: string
): Promise<object> {
  const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return await translateJsonValue(content, from, to, apiUrl);
}

async function processIniFile(
  filePath: string,
  from: string,
  to: string,
  apiUrl: string
): Promise<TranslatedContent> {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const parsedLines = parseIniWithComments(fileContent);
  const translatedContent: TranslatedContent = {};
  let currentSection = "";

  for (const line of parsedLines) {
    switch (line.type) {
      case "section":
        const sectionMatch = line.content.match(/\[(.*?)\]/);
        if (sectionMatch) {
          currentSection = sectionMatch[1];
          translatedContent[currentSection] = {};
        }
        break;

      case "key":
        if (line.key && line.value) {
          if (!currentSection) {
            currentSection = "default";
            translatedContent[currentSection] = {};
          }

          if (line.value.trim()) {
            translatedContent[currentSection][line.key] = await translateText(
              line.value,
              from,
              to,
              apiUrl
            );
          } else {
            translatedContent[currentSection][line.key] = line.value;
          }
        }
        break;
    }
  }

  return translatedContent;
}

async function main() {
  const { json, ini: isIni, from, to, libretranslateUrl } = options;
  const filePath = program.args[0];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error("Error: File does not exist");
    process.exit(1);
  }

  // Check file type
  if (!json && !isIni) {
    console.error("Error: Please specify either --json or --ini");
    process.exit(1);
  }

  // Check if LibreTranslate is accessible
  const isApiAccessible = await checkLibreTranslateAccess(libretranslateUrl);
  if (!isApiAccessible) {
    console.error("Error: LibreTranslate API is not accessible");
    process.exit(1);
  }

  try {
    if (json) {
      const translatedContent = await processJsonFile(
        filePath,
        from,
        to,
        libretranslateUrl
      );
      // Write translated JSON
      const outputPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, ".json")}_translated.json`
      );
      fs.writeFileSync(outputPath, JSON.stringify(translatedContent, null, 2));
    } else {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const parsedLines = parseIniWithComments(fileContent);
      const translatedContent = await processIniFile(
        filePath,
        from,
        to,
        libretranslateUrl
      );

      // Write translated INI while preserving structure and comments
      const outputPath = path.join(
        path.dirname(filePath),
        `${path.basename(filePath, ".ini")}_translated.ini`
      );

      let outputContent = "";
      let currentSection = "";

      for (const line of parsedLines) {
        switch (line.type) {
          case "section":
            const sectionMatch = line.content.match(/\[(.*?)\]/);
            if (sectionMatch) {
              currentSection = sectionMatch[1];
              outputContent += line.content + "\n";
            }
            break;

          case "key":
            if (line.key && line.value) {
              if (!currentSection) {
                currentSection = "default";
                outputContent += "[default]\n";
              }

              const translatedValue =
                translatedContent[currentSection][line.key];
              outputContent += `${line.key}=${translatedValue}\n`;
            } else {
              outputContent += line.content + "\n";
            }
            break;

          case "comment":
          case "empty":
            outputContent += line.content + "\n";
            break;
        }
      }

      fs.writeFileSync(outputPath, outputContent);
    }

    console.log("Translation completed successfully!");
  } catch (error) {
    console.error("Error during translation:", error);
    process.exit(1);
  }
}

main().catch(console.error);
