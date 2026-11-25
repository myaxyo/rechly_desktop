/**
 * ZUGFeRD 2.3 / Factur-X 1.07 (PDF/A-3b, EN 16931) Hybrid PDF Generator
 *
 * Embeds the CII XML payload as `factur-x.xml` into an Electron-rendered A4 PDF,
 * adds an sRGB OutputIntent, PDF/A-3 /AF association, and Factur-X XMP metadata
 * completely offline using `pdf-lib`.
 */

import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

export interface ZugferdPdfMetadata {
    invoiceNumber: string;
    sellerName: string;
    issueDate?: string;
}

function escapeXmp(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function pad4(length: number): number {
    return (length + 3) & ~3;
}

function s15Fixed16(value: number): number {
    return Math.round(value * 65536);
}

/**
 * Builds a minimal, spec-valid ICC v2.1 sRGB (IEC 61966-2.1) RGB display profile
 * so PDF/A-3b OutputIntents require no external files or proprietary system profiles.
 */
export function buildMinimalSrgbIccProfile(): Uint8Array {
    const textType = (str: string): Buffer => {
        const ascii = Buffer.from(`${str}\0`, "ascii");
        const buf = Buffer.alloc(pad4(8 + ascii.length));
        buf.write("text", 0, "ascii");
        ascii.copy(buf, 8);
        return buf;
    };

    const descType = (str: string): Buffer => {
        const ascii = Buffer.from(`${str}\0`, "ascii");
        // 12 bytes header+count + ascii + 67 bytes Apple/Unicode/ScriptCode footer
        const rawLen = 12 + ascii.length + 67;
        const buf = Buffer.alloc(pad4(rawLen));
        buf.write("desc", 0, "ascii");
        buf.writeUInt32BE(ascii.length, 8);
        ascii.copy(buf, 12);
        return buf;
    };

    const xyzType = (x: number, y: number, z: number): Buffer => {
        const buf = Buffer.alloc(20);
        buf.write("XYZ ", 0, "ascii");
        buf.writeInt32BE(s15Fixed16(x), 8);
        buf.writeInt32BE(s15Fixed16(y), 12);
        buf.writeInt32BE(s15Fixed16(z), 16);
        return buf;
    };

    const curvGamma22 = (): Buffer => {
        const buf = Buffer.alloc(16);
        buf.write("curv", 0, "ascii");
        buf.writeUInt32BE(1, 8); // 1-entry u8Fixed8Number gamma
        buf.writeUInt16BE(Math.round(2.2 * 256), 12);
        return buf;
    };

    const trcData = curvGamma22();
    const tagEntries: Array<{ sig: string; data: Buffer; sharedWith?: string }> = [
        { sig: "desc", data: descType("sRGB IEC61966-2.1") },
        { sig: "cprt", data: textType("CC0 Public Domain") },
        { sig: "wtpt", data: xyzType(0.95045, 1.0, 1.08905) },
        { sig: "rXYZ", data: xyzType(0.43607, 0.22250, 0.01393) },
        { sig: "gXYZ", data: xyzType(0.38515, 0.71687, 0.09710) },
        { sig: "bXYZ", data: xyzType(0.14307, 0.06062, 0.71417) },
        { sig: "rTRC", data: trcData },
        { sig: "gTRC", data: trcData, sharedWith: "rTRC" },
        { sig: "bTRC", data: trcData, sharedWith: "rTRC" },
    ];

    const headerSize = 128;
    const tagTableSize = 4 + tagEntries.length * 12;
    let cursor = pad4(headerSize + tagTableSize);

    const offsets = new Map<string, { offset: number; size: number }>();
    const bodyChunks: Buffer[] = [];
    for (const entry of tagEntries) {
        if (entry.sharedWith) {
            offsets.set(entry.sig, offsets.get(entry.sharedWith)!);
            continue;
        }
        offsets.set(entry.sig, { offset: cursor, size: entry.data.length });
        bodyChunks.push(entry.data);
        cursor += entry.data.length;
    }

    const totalSize = cursor;
    const icc = Buffer.alloc(totalSize);

    // ICC Header (128 bytes)
    icc.writeUInt32BE(totalSize, 0);
    icc.writeUInt32BE(0x02100000, 8); // v2.1.0
    icc.write("mntr", 12, "ascii");
    icc.write("RGB ", 16, "ascii");
    icc.write("XYZ ", 20, "ascii");
    icc.writeUInt16BE(2026, 24);
    icc.writeUInt16BE(1, 26);
    icc.writeUInt16BE(1, 28);
    icc.write("acsp", 36, "ascii");
    // D50 illuminant in PCS
    icc.writeInt32BE(s15Fixed16(0.9642), 68);
    icc.writeInt32BE(s15Fixed16(1.0), 72);
    icc.writeInt32BE(s15Fixed16(0.8249), 76);

    // Tag table
    icc.writeUInt32BE(tagEntries.length, headerSize);
    tagEntries.forEach((entry, idx) => {
        const recOffset = headerSize + 4 + idx * 12;
        const pos = offsets.get(entry.sig)!;
        icc.write(entry.sig, recOffset, "ascii");
        icc.writeUInt32BE(pos.offset, recOffset + 4);
        icc.writeUInt32BE(pos.size, recOffset + 8);
    });

    // Tag payloads
    let writePos = pad4(headerSize + tagTableSize);
    for (const chunk of bodyChunks) {
        chunk.copy(icc, writePos);
        writePos += chunk.length;
    }

    return new Uint8Array(icc);
}

/**
 * Builds PDF/A-3b + ZUGFeRD 2.3 / Factur-X 1.07 (EN 16931) XMP metadata packet.
 */
export function buildZugferdXmpMetadata(meta: ZugferdPdfMetadata, timestampIso: string): string {
    const title = escapeXmp(`Rechnung ${meta.invoiceNumber || ""}`.trim());
    const creator = escapeXmp(meta.sellerName || "Rechly Desktop");
    const description = escapeXmp(`ZUGFeRD 2.3 / Factur-X EN 16931 Rechnung ${meta.invoiceNumber || ""}`.trim());

    return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
      <pdfaid:part>3</pdfaid:part>
      <pdfaid:conformance>B</pdfaid:conformance>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:title>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${title}</rdf:li>
        </rdf:Alt>
      </dc:title>
      <dc:creator>
        <rdf:Seq>
          <rdf:li>${creator}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:description>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">${description}</rdf:li>
        </rdf:Alt>
      </dc:description>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:xmp="http://ns.adobe.com/xap/1.0/">
      <xmp:CreatorTool>Rechly Desktop</xmp:CreatorTool>
      <xmp:CreateDate>${timestampIso}</xmp:CreateDate>
      <xmp:ModifyDate>${timestampIso}</xmp:ModifyDate>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
      <pdf:Producer>Rechly Desktop</pdf:Producer>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/"
      xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#"
      xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
      <pdfaExtension:schemas>
        <rdf:Bag>
          <rdf:li rdf:parseType="Resource">
            <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
            <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
            <pdfaSchema:prefix>fx</pdfaSchema:prefix>
            <pdfaSchema:property>
              <rdf:Seq>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>name of the embedded XML invoice file</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>DocumentType</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>INVOICE</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>Version</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The actual version of the Factur-X XML schema</pdfaProperty:description>
                </rdf:li>
                <rdf:li rdf:parseType="Resource">
                  <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
                  <pdfaProperty:valueType>Text</pdfaProperty:valueType>
                  <pdfaProperty:category>external</pdfaProperty:category>
                  <pdfaProperty:description>The conformance level of the embedded Factur-X data</pdfaProperty:description>
                </rdf:li>
              </rdf:Seq>
            </pdfaSchema:property>
          </rdf:li>
        </rdf:Bag>
      </pdfaExtension:schemas>
    </rdf:Description>
    <rdf:Description rdf:about=""
      xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
      <fx:DocumentType>INVOICE</fx:DocumentType>
      <fx:DocumentFileName>factur-x.xml</fx:DocumentFileName>
      <fx:Version>1.0</fx:Version>
      <fx:ConformanceLevel>EN 16931</fx:ConformanceLevel>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

/**
 * Converts a rendered invoice PDF buffer into a ZUGFeRD 2.3 / Factur-X (PDF/A-3b)
 * hybrid PDF containing `factur-x.xml`.
 */
export async function createZugferdPdf(
    basePdfBuffer: Buffer | Uint8Array,
    xml: string,
    meta: ZugferdPdfMetadata
): Promise<Buffer> {
    const pdfDoc = await PDFDocument.load(basePdfBuffer, { updateMetadata: false });
    const now = new Date();
    const timestampIso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
    const xmlBytes = Buffer.from(xml, "utf8");

    // 1. Embed factur-x.xml with PDF/A-3 /AFRelationship and EF << /F /UF >>
    const embeddedFileStream = pdfDoc.context.flateStream(xmlBytes, {
        Type: "EmbeddedFile",
        Subtype: "text/xml",
        Params: {
            Size: xmlBytes.length,
            CreationDate: PDFString.fromDate(now),
            ModDate: PDFString.fromDate(now),
        },
    });
    const embeddedFileRef = pdfDoc.context.register(embeddedFileStream);

    const fileSpecDict = pdfDoc.context.obj({
        Type: "Filespec",
        F: PDFString.of("factur-x.xml"),
        UF: PDFHexString.fromText("factur-x.xml"),
        EF: { F: embeddedFileRef, UF: embeddedFileRef },
        Desc: PDFHexString.fromText("ZUGFeRD 2.3 / Factur-X EN 16931 Rechnung (XML)"),
        AFRelationship: PDFName.of("Alternative"),
    });
    const fileSpecRef = pdfDoc.context.register(fileSpecDict);

    // Register in Catalog /Names -> /EmbeddedFiles
    const namesDict = pdfDoc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict)
        ?? pdfDoc.context.obj({});
    const embeddedFilesTree = pdfDoc.context.obj({
        Names: [PDFString.of("factur-x.xml"), fileSpecRef],
    });
    namesDict.set(PDFName.of("EmbeddedFiles"), embeddedFilesTree);
    pdfDoc.catalog.set(PDFName.of("Names"), namesDict);

    // Register in Catalog /AF (required by PDF/A-3)
    const existingAf = pdfDoc.catalog.lookupMaybe(PDFName.of("AF"), PDFArray);
    if (existingAf) {
        existingAf.push(fileSpecRef);
    } else {
        pdfDoc.catalog.set(PDFName.of("AF"), pdfDoc.context.obj([fileSpecRef]));
    }

    // 2. Embed sRGB OutputIntent (required for PDF/A-3b)
    const iccStream = pdfDoc.context.flateStream(buildMinimalSrgbIccProfile(), { N: 3 });
    const iccRef = pdfDoc.context.register(iccStream);
    const outputIntent = pdfDoc.context.obj({
        Type: "OutputIntent",
        S: "GTS_PDFA1",
        OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
        RegistryName: PDFString.of("http://www.color.org"),
        Info: PDFString.of("sRGB IEC61966-2.1"),
        DestOutputProfile: iccRef,
    });
    pdfDoc.catalog.set(PDFName.of("OutputIntents"), pdfDoc.context.obj([outputIntent]));

    // 3. Embed uncompressed XMP Metadata stream (required for PDF/A-3b + Factur-X)
    const xmpBytes = Buffer.from(buildZugferdXmpMetadata(meta, timestampIso), "utf8");
    const metadataStream = pdfDoc.context.stream(xmpBytes, {
        Type: "Metadata",
        Subtype: "XML",
    });
    const metadataRef = pdfDoc.context.register(metadataStream);
    pdfDoc.catalog.set(PDFName.of("Metadata"), metadataRef);
    pdfDoc.catalog.set(PDFName.of("Lang"), PDFString.of("de-DE"));

    // 4. Sync Document Info dictionary
    pdfDoc.setTitle(`Rechnung ${meta.invoiceNumber || ""}`.trim());
    pdfDoc.setAuthor(meta.sellerName || "Rechly Desktop");
    pdfDoc.setSubject(`ZUGFeRD 2.3 / Factur-X EN 16931 Rechnung ${meta.invoiceNumber || ""}`.trim());
    pdfDoc.setCreator("Rechly Desktop");
    pdfDoc.setProducer("Rechly Desktop");
    pdfDoc.setCreationDate(now);
    pdfDoc.setModificationDate(now);

    const saved = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(saved);
}
