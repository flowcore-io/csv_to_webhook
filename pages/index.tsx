'use client';

import React, { useState, ChangeEvent } from 'react';
import { parallel } from 'radash';
import Link from 'next/link';
import Image from 'next/image';

type Line = string;
type Header = string;
type JSONLine = { [key: string]: string };
let sent: number = 0
const batchLineCount: number = 100
const concurrency: number = 50

export default function Home() {
  const [status, setStatus] = useState<string>('Ready to upload');
  const [processedLines, setProcessedLines] = useState(0);
  const [webhookUrl, setWebhookUrl] = useState('https://webhook.api.staging.flowcore.io/events/...');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleWebhookUrlChange = (event: any) => {
    setWebhookUrl(event.target.value);
  };

  const handleFileUpload = async () => {
    sent = 0;
    if (!selectedFile) {
      alert('Please select a file first.');
      return;
    }
  
    const totalSize = selectedFile.size;
    let processedSize = 0;
  
    setStatus('Processing...');
  
    const reader = selectedFile.stream().getReader();
    let decoder = new TextDecoder();
    let partialLine = '';
    let headers: Header[] = [];
    let firstLine = true;
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
  
        processedSize += value.length;
        const progress = (processedSize / totalSize) * 100;
        setProcessedLines(progress);
  
        const textChunk = decoder.decode(value, { stream: true });
        const result = processChunk(textChunk, partialLine);
        partialLine = result.partialLine;
  
        if (firstLine) {
          const headerLine = result.lines.shift();
          if (headerLine) {
            headers = headerLine.split(',') as Header[];
            firstLine = false;
          }
        }
  
        let lines: any = result.lines
          .filter(line => typeof line === 'string')
          .map((line: Line) => lineToJSON(line, headers));
        let batches: JSONLine[][] = [];
  
        while (lines.length >= batchLineCount) {
          const batch = lines.splice(0, batchLineCount).map((line: any) => lineToJSON(line, headers));
          batches.push(batch);
        }
  
        if (lines.length > 0) {
          const remainingBatch = lines.map((line: any) => lineToJSON(line, headers));
          batches.push(remainingBatch);
        }

        // Use radash for parallel processing
        await parallel(concurrency, batches, postToWebhook);
        
        if (partialLine) {
          await postToWebhook([lineToJSON(partialLine, headers)]);
        }
      }
  
      setStatus('Upload complete');
    } catch (error) {
      console.error('Error processing file:', error);
      setStatus(`Error: ${error}`);
    }
  };

  const processChunk = (chunkText: string, partialLine: string): { lines: Line[], partialLine: string } => {
    const chunkLines = chunkText.split('\n');
    chunkLines[0] = partialLine + chunkLines[0];
    const newPartialLine = chunkLines.pop() || '';
    return { lines: chunkLines, partialLine: newPartialLine };
  };

  const lineToJSON = (line: Line, headers: Header[]): JSONLine => {
    if (typeof line !== "string") {
      return {}
    }
    const values = line.split(',');
    return headers.reduce((obj: JSONLine, header: Header, index: number) => {
      obj[header] = values[index];
      return obj;
    }, {});
  };

  const postToWebhook = async (batch: JSONLine[]): Promise<void> => {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch)
    });
    sent += batch.length;
  };

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="w-full max-w-lg text-gray-700 flex justify-center text-2xl">Stream a CSV file to a webhook</h1>
      <p className="w-full max-w-lg text-gray-700 flex justify-center text-xs mb-4">The program streams a CSV file, converting its contents into JSON objects with batches of {batchLineCount} records each, and then POSTs these batches, using concurrency to a specified webhook URLutilizing a concurrency level of {concurrency}.</p>
      <form className="w-full max-w-lg bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <div className="mb-4">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="file">
            CSV File
          </label>
          <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" type="file" onChange={handleFileSelection} />
        </div>
        <div className="mb-6">
          <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="webhook">
            Webhook URL
          </label>
          <input className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" id="webhook" type="text" value={webhookUrl} onChange={handleWebhookUrlChange} />
        </div>
        <div className="flex items-center justify-between">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type="button" onClick={handleFileUpload}>
            Start
          </button>
          <div className="w-full max-w-lg flex justify-end items-center mt-4">
            <Link href="https://www.flowcore.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-700 mr-2">
              Powered by Flowcore
            </Link>
            <Image src="/favicon.ico" alt="Flowcore icon" width={16} height={16} />
          </div>
        </div>
      </form>
      <div className="w-full max-w-lg">
        <p className="text-gray-700 mb-2">Status: {status}</p>
      <div className="bg-gray-200 rounded h-4 overflow-hidden">
        <div className="bg-blue-600 h-4" style={{ width: `${processedLines.toFixed(0)}%` }} />
      </div>
        <p className="text-gray-700 mt-2">{`Progress: ${processedLines.toFixed(0)}/100`}</p> {/* Replace 100 with totalLines if available */}
      </div>
    </main>
  );
}
