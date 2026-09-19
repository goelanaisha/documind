import { NextRequest, NextResponse } from "next/server";
import { retrieveChunks } from "@/lib/vectorestore";
import { getEmbedding } from "@/lib/embeddings";
export async function POST(request: NextRequest) {
  try {
    const { question, docId } = await request.json();

    if (!question || !docId) {
      return NextResponse.json(
        { error: "Question and docId are required" },
        { status: 400 }
      );
    }

    // Step 1: embed the question
    const questionEmbedding = await getEmbedding(question);

    // Step 2: retrieve relevant chunks
    const relevantChunks = retrieveChunks(docId, questionEmbedding, 3);

    if (relevantChunks.length === 0) {
      return NextResponse.json(
        { error: "No relevant content found for this question" },
        { status: 404 }
      );
    }

    // Step 3: build context from retrieved chunks
    const context = relevantChunks
      .map((c, i) => `[Source ${i + 1}]\n${c.text}`)
      .join("\n\n");

    // Step 4: stream the answer
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        max_tokens: 512,
        stream: true,
        messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions about documents.
Answer using ONLY the context provided below.
Always mention which source number your answer comes from.
If the context doesn't contain enough information, say "I don't have enough information in this document to answer that."

Context:
${context}`
        },
        {
          role: "user",
          content: question
        }
        ]
      })
    });

    if (!groqResponse.ok || !groqResponse.body) {
      throw new Error(`Groq API request failed: ${groqResponse.status}`);
    }

    // Return streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = groqResponse.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const data = line.slice(6).trim();
              if (data === "[DONE]") continue;
              const text = JSON.parse(data).choices?.[0]?.delta?.content ?? "";
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                );
              }
            }
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                sources: relevantChunks.map((c, i) => ({
                  index: i + 1,
                  text: c.text.substring(0, 150) + "...",
                  source: c.source
                }))
              })}\n\n`
            )
          );
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new NextResponse(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });

  } catch (error) {
    console.error("Chat error:", error);
    return NextResponse.json(
      { error: "Failed to process question" },
      { status: 500 }
    );
  }
}