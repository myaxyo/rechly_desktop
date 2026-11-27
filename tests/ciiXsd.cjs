"use strict";

/**
 * Checks generated CII against the unmodified UN/CEFACT Cross Industry Invoice
 * D16B schemas in tests/fixtures/cii-d16b (the schema KoSIT uses). Element order
 * is validated in-process so Windows CI does not need xmllint. When xmllint is
 * on PATH it also runs a full schema validation.
 */

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SCHEMA_DIR = path.join(__dirname, "fixtures/cii-d16b");
const MAIN_XSD = path.join(SCHEMA_DIR, "CrossIndustryInvoice_100pD16B.xsd");

let cachedTypes = null;

function matchingClose(text, tagName, from) {
    const openToken = `<${tagName}`;
    const closeToken = `</${tagName}>`;
    let depth = 1;
    let i = from;
    while (i < text.length && depth > 0) {
        const nextOpen = text.indexOf(openToken, i);
        const nextClose = text.indexOf(closeToken, i);
        if (nextClose < 0) throw new Error(`Unclosed <${tagName}> in XSD`);
        const openIsTag = nextOpen >= 0 && nextOpen < nextClose && /[\s>/]/.test(text[nextOpen + openToken.length] || "");
        if (openIsTag) {
            depth += 1;
            i = nextOpen + openToken.length;
            continue;
        }
        depth -= 1;
        if (depth === 0) return nextClose;
        i = nextClose + closeToken.length;
    }
    throw new Error(`Unclosed <${tagName}> in XSD`);
}

function innerXml(text, tagName, from) {
    const openEnd = text.indexOf(">", from);
    const selfClosing = text[openEnd - 1] === "/";
    if (selfClosing) return { inner: "", next: openEnd + 1, selfClosing: true };
    const closeAt = matchingClose(text, tagName, openEnd + 1);
    return { inner: text.slice(openEnd + 1, closeAt), next: closeAt + `</${tagName}>`.length, selfClosing: false };
}

function stripAnnotations(xml) {
    let out = "";
    let i = 0;
    while (i < xml.length) {
        const at = xml.indexOf("<xsd:annotation", i);
        if (at < 0) {
            out += xml.slice(i);
            break;
        }
        out += xml.slice(i, at);
        const close = matchingClose(xml, "xsd:annotation", xml.indexOf(">", at) + 1);
        i = close + "</xsd:annotation>".length;
    }
    return out;
}

function attrMap(tagBody) {
    const attrs = {};
    const re = /([A-Za-z0-9:]+)="([^"]*)"/g;
    let match;
    while ((match = re.exec(tagBody))) attrs[match[1]] = match[2];
    return attrs;
}

function directParticles(inner) {
    const particles = [];
    let i = 0;
    while (i < inner.length) {
        const lt = inner.indexOf("<", i);
        if (lt < 0) break;
        if (inner.startsWith("<!--", lt)) {
            i = inner.indexOf("-->", lt) + 3;
            continue;
        }
        const tagEnd = inner.indexOf(">", lt);
        let raw = inner.slice(lt + 1, tagEnd).trim();
        const selfClosing = raw.endsWith("/");
        if (selfClosing) raw = raw.slice(0, -1).trim();
        const tagName = raw.split(/\s+/)[0];
        if (tagName.startsWith("/")) break;
        if (tagName === "xsd:element") {
            const attrs = attrMap(raw);
            const maxRaw = attrs.maxOccurs;
            particles.push({
                name: attrs.name,
                type: attrs.type ? attrs.type.split(":").pop() : null,
                min: attrs.minOccurs === undefined ? 1 : Number(attrs.minOccurs),
                max: maxRaw === "unbounded" ? Infinity : maxRaw === undefined ? 1 : Number(maxRaw),
            });
        }
        if (selfClosing) {
            i = tagEnd + 1;
            continue;
        }
        const skipped = innerXml(inner, tagName, lt);
        i = skipped.next;
    }
    return particles;
}

function parseTypeBody(body) {
    const stripped = stripAnnotations(body).trim();
    if (stripped.startsWith("<xsd:simpleContent") || stripped.startsWith("<xsd:complexContent")) {
        return { kind: "simple" };
    }
    const kind = stripped.startsWith("<xsd:choice") ? "choice" : stripped.startsWith("<xsd:sequence") ? "sequence" : null;
    if (!kind) return { kind: "simple" };
    const tag = kind === "choice" ? "xsd:choice" : "xsd:sequence";
    const block = innerXml(stripped, tag, 0);
    return { kind, particles: directParticles(block.inner) };
}

function loadTypes() {
    if (cachedTypes) return cachedTypes;
    const types = new Map();
    for (const file of fs.readdirSync(SCHEMA_DIR).filter((name) => name.endsWith(".xsd"))) {
        const text = fs.readFileSync(path.join(SCHEMA_DIR, file), "utf8");
        const re = /<xsd:complexType name="([^"]+)">/g;
        let match;
        while ((match = re.exec(text))) {
            const openEnd = text.indexOf(">", match.index) + 1;
            const closeAt = matchingClose(text, "xsd:complexType", openEnd);
            types.set(match[1], parseTypeBody(text.slice(openEnd, closeAt)));
        }
    }
    cachedTypes = types;
    return types;
}

function parseXml(xml) {
    const source = xml.replace(/<\?xml[\s\S]*?\?>/, "");
    let i = 0;
    function skipNoise() {
        while (i < source.length) {
            if (/\s/.test(source[i])) {
                i += 1;
                continue;
            }
            if (source.startsWith("<!--", i)) {
                i = source.indexOf("-->", i) + 3;
                continue;
            }
            if (source[i] !== "<") {
                const next = source.indexOf("<", i);
                i = next < 0 ? source.length : next;
                continue;
            }
            break;
        }
    }
    function parseNodes() {
        const nodes = [];
        while (i < source.length) {
            skipNoise();
            if (i >= source.length || source.startsWith("</", i)) break;
            const tagEnd = source.indexOf(">", i);
            let raw = source.slice(i + 1, tagEnd).trim();
            const selfClosing = raw.endsWith("/");
            if (selfClosing) raw = raw.slice(0, -1).trim();
            const rawName = raw.split(/\s+/)[0];
            const name = rawName.includes(":") ? rawName.slice(rawName.indexOf(":") + 1) : rawName;
            i = tagEnd + 1;
            const children = selfClosing ? [] : parseNodes();
            if (!selfClosing) {
                skipNoise();
                if (!source.startsWith("</", i)) throw new Error(`Expected closing tag for ${name}`);
                i = source.indexOf(">", i) + 1;
            }
            nodes.push({ name, children });
        }
        return nodes;
    }
    const roots = parseNodes();
    if (roots.length !== 1) throw new Error(`Expected one XML root, found ${roots.length}`);
    return roots[0];
}

function validateNode(node, typeName, path, types) {
    const type = types.get(typeName);
    if (!type || type.kind === "simple") {
        if (node.children.length) {
            throw new Error(`${path} (${typeName || "inline"}) must not contain child elements`);
        }
        return;
    }
    const children = node.children;
    if (type.kind === "choice") {
        if (!children.length) throw new Error(`${path} is missing a choice element`);
        const particle = type.particles.find((item) => item.name === children[0].name);
        if (!particle) {
            throw new Error(`${path}: unexpected <${children[0].name}>, expected one of ${type.particles.map((item) => item.name).join(", ")}`);
        }
        let count = 0;
        let index = 0;
        while (index < children.length && children[index].name === particle.name && count < particle.max) {
            if (particle.type) validateNode(children[index], particle.type, `${path}/${children[index].name}`, types);
            index += 1;
            count += 1;
        }
        if (index < children.length) {
            throw new Error(`${path}: unexpected <${children[index].name}> after <${particle.name}>`);
        }
        return;
    }
    let index = 0;
    for (const particle of type.particles) {
        let count = 0;
        while (index < children.length && children[index].name === particle.name && count < particle.max) {
            if (particle.type) validateNode(children[index], particle.type, `${path}/${children[index].name}`, types);
            index += 1;
            count += 1;
        }
        if (count < particle.min) {
            const found = children[index] ? `<${children[index].name}>` : "end of element";
            throw new Error(`${path}: expected <${particle.name}> but found ${found}`);
        }
    }
    if (index < children.length) {
        throw new Error(`${path}: unexpected <${children[index].name}> (not allowed after the preceding elements in ${typeName})`);
    }
}

function assertCiiElementOrder(xml) {
    const types = loadTypes();
    const root = parseXml(xml);
    if (root.name !== "CrossIndustryInvoice") throw new Error(`Unexpected root <${root.name}>`);
    validateNode(root, "CrossIndustryInvoiceType", "/rsm:CrossIndustryInvoice", types);
}

function xmllintAvailable() {
    const probe = spawnSync("xmllint", ["--version"], { encoding: "utf8" });
    return !probe.error;
}

function assertCiiXsd(xml) {
    assertCiiElementOrder(xml);
    if (!xmllintAvailable()) return { xmllint: false };
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rechly-cii-"));
    const file = path.join(dir, "invoice.xml");
    fs.writeFileSync(file, xml);
    try {
        const result = spawnSync("xmllint", ["--noout", "--schema", MAIN_XSD, file], { encoding: "utf8" });
        if (result.status !== 0) {
            throw new Error((result.stderr || result.stdout || "xmllint failed").trim());
        }
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    return { xmllint: true };
}

module.exports = { assertCiiElementOrder, assertCiiXsd, xmllintAvailable };
