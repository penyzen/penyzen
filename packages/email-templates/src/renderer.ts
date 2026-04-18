import Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.join(__dirname, 'templates');
const LAYOUTS_DIR = path.join(__dirname, 'layouts');

// Cache compiled templates in memory (warm Lambda invocations reuse these)
const templateCache = new Map<string, HandlebarsTemplateDelegate>();
const layoutCache = new Map<string, HandlebarsTemplateDelegate>();

function loadTemplate(name: string): HandlebarsTemplateDelegate {
  const cached = templateCache.get(name);
  if (cached) return cached;

  const filePath = path.join(TEMPLATES_DIR, `${name}.hbs`);
  const source = fs.readFileSync(filePath, 'utf-8');
  const compiled = Handlebars.compile(source);
  templateCache.set(name, compiled);
  return compiled;
}

function loadLayout(name: string): HandlebarsTemplateDelegate {
  const cached = layoutCache.get(name);
  if (cached) return cached;

  const filePath = path.join(LAYOUTS_DIR, `${name}.hbs`);
  const source = fs.readFileSync(filePath, 'utf-8');
  const compiled = Handlebars.compile(source);
  layoutCache.set(name, compiled);
  return compiled;
}

export interface RenderResult {
  subject: string;
  html: string;
  text: string;
}

export function renderEmail(
  templateName: string,
  data: Record<string, unknown>,
): RenderResult {
  const appName = process.env['APP_NAME'] ?? 'Penyzen';
  const appUrl = process.env['APP_URL'] ?? 'https://www.penyzen.com';

  const templateContext = { ...data, appName, appUrl };

  const contentTemplate = loadTemplate(templateName);
  const content = contentTemplate(templateContext);

  const baseLayout = loadLayout('base');
  const html = baseLayout({ ...templateContext, content, subject: data['subject'] as string ?? appName });

  // Simple text version: strip HTML tags
  const text = content.replace(/<[^>]+>/g, '').replace(/\s{2,}/g, ' ').trim();

  return {
    subject: (data['subject'] as string) ?? appName,
    html,
    text,
  };
}
