import PizZip from 'pizzip';

/**
 * DocxAppender
 * Responsible for injecting images as new pages at the end of a DOCX file.
 * Handles low-level XML manipulation in the ZIP archive.
 */
export class DocxAppender {

  /**
   * Appends a list of images to the end of a DOCX file.
   * @param initialDocxBlob The filled DOCX form
   * @param images List of images (ArrayBuffer) to append
   */
  public static async appendImages(initialDocxBlob: Blob, images: ArrayBuffer[]): Promise<Blob> {
    if (images.length === 0) return initialDocxBlob;

    const zip = new PizZip(await initialDocxBlob.arrayBuffer());
    
    // 1. Prepare Relationship IDs
    const relsFile = zip.file("word/_rels/document.xml.rels");
    let relsXml = relsFile ? relsFile.asText() : "";
    let lastRId = DocxAppender.getLastRId(relsXml);

    // 2. Prepare content to append
    let xmlAppend = "";
    
    images.forEach((imgBuffer, index) => {
        const rId = `rId${++lastRId}`;
        const imgFileName = `media/appendix_img_${Date.now()}_${index}.jpg`;
        
        // A. Add file to zip
        zip.file(`word/${imgFileName}`, imgBuffer);

        // B. Add relationship
        relsXml = DocxAppender.addRelationship(relsXml, rId, imgFileName);

        // C. Generate WordXML for Full Page Image
        xmlAppend += DocxAppender.generatePageBreakAndImageXml(rId);
    });

    // 3. Update Rels file
    zip.file("word/_rels/document.xml.rels", relsXml);

    // 4. Update Document XML
    const docFile = zip.file("word/document.xml");
    if (docFile) {
        let docXml = docFile.asText();
        // Insert before the end of the body
        const splitIndex = docXml.lastIndexOf("</w:body>");
        if (splitIndex !== -1) {
            docXml = docXml.substring(0, splitIndex) + xmlAppend + docXml.substring(splitIndex);
            zip.file("word/document.xml", docXml);
        }
    }

    return zip.generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  private static getLastRId(relsXml: string): number {
    const matches = relsXml.match(/Id="rId(\d+)"/g);
    let maxId = 0;
    if (matches) {
        matches.forEach(m => {
            const id = parseInt(m.match(/Id="rId(\d+)"/)?.[1] || "0");
            if (id > maxId) maxId = id;
        });
    }
    return maxId;
  }

  private static addRelationship(xml: string, rId: string, target: string): string {
      const relTag = `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
      return xml.replace("</Relationships>", `${relTag}</Relationships>`);
  }

  private static generatePageBreakAndImageXml(rId: string): string {
    // 6000000 EMUs approx = 100% width/height of standard page logic (simplified)
    // We use a "Page Break" <w:br w:type="page"/> followed by the drawing
    
    // This XML block defines a paragraph with a page break, then an inline drawing.
    return `
    <w:p>
      <w:r>
        <w:br w:type="page"/>
      </w:r>
    </w:p>
    <w:p>
      <w:r>
        <w:drawing>
          <wp:inline distT="0" distB="0" distL="0" distR="0">
            <wp:extent cx="5953500" cy="8419500"/>
            <wp:effectExtent l="0" t="0" r="0" b="0"/>
            <wp:docPr id="1" name="Appendix Image"/>
            <wp:cNvGraphicFramePr>
              <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
            </wp:cNvGraphicFramePr>
            <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
              <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                  <pic:nvPicPr>
                    <pic:cNvPr id="0" name="Picture"/>
                    <pic:cNvPicPr/>
                  </pic:nvPicPr>
                  <pic:blipFill>
                    <a:blip r:embed="${rId}"/>
                    <a:stretch>
                      <a:fillRect/>
                    </a:stretch>
                  </pic:blipFill>
                  <pic:spPr>
                    <a:xfrm>
                      <a:off x="0" y="0"/>
                      <a:ext cx="5953500" cy="8419500"/>
                    </a:xfrm>
                    <a:prstGeom prst="rect">
                      <a:avLst/>
                    </a:prstGeom>
                  </pic:spPr>
                </pic:pic>
              </a:graphicData>
            </a:graphic>
          </wp:inline>
        </w:drawing>
      </w:r>
    </w:p>
    `;
  }
}