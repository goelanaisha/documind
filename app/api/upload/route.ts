import {NextResponse,NextRequest} from "next/server";
import{extractTextFromPDF} from "@/lib/pdf";
import{chunkText} from "@/lib/chunker";
import{indexDocument} from "@/lib/vectorestore";
import{randomUUID} from "crypto";

export async function POST(req: NextRequest) {
    try{
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file){
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

   if (!file.name.endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`Extracting text from: ${file.name}`);
    const text = await extractTextFromPDF(buffer);

if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract text from PDF. The file may be scanned or image-based." },
        { status: 400 }
      );
    }

    const chunks = chunkText(text);
    console.log(`Split into ${chunks.length} chunks.`);

    const docId= randomUUID();
    await indexDocument(docId, file.name, chunks);
    console.log(`Indexed document with ID: ${docId}`);
    return NextResponse.json({
      success: true,
      docId,
      filename: file.name,
      chunkCount: chunks.length,
      preview: text.substring(0, 200) + "..." // first 200 chars as preview
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process PDF" },
      { status: 500 }
    );
  }
}
