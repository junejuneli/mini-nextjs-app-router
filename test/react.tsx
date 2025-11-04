import React, { Suspense } from 'react';
import { renderToStaticMarkup, renderToString } from 'react-dom/server';
import { prerender } from 'react-dom/static';

// Server Component - 只使用纯 props,不使用 hooks
function App(params: any = {}) {
    const { name = 'hello' } = params;
    return (
        <div>
            <p>I am test renderToStaticMarkup</p>
            <p>Name: {name}</p>
            <button>Add one</button>
            <button>Reduce one</button>
            <Suspense fallback={<div>Loading</div>}>
                <p>Content loaded</p>
            </Suspense>
        </div>
    );
}

// 辅助函数: 读取 ReadableStream
async function streamToString(stream: ReadableStream): Promise<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let result = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true });
    }

    return result;
}

// 执行测试
async function runTests() {
    console.log('=== Testing React Server-Side Rendering APIs ===\n');

    // Test 1: renderToStaticMarkup (静态 HTML,无 React 属性)
    console.log('1. renderToStaticMarkup (Static HTML, no React attributes):');
    const html = renderToStaticMarkup(<App name="World" />);
    console.log(html);
    console.log('\n');

    // Test 2: renderToString (带 React 属性,用于 hydration)
    console.log('2. renderToString (HTML with React attributes for hydration):');
    const html2 = renderToString(<App name="World" />);
    console.log(html2);
    console.log('\n');

    // Test 3: prerender (React 19 新 API,返回 stream)
    console.log('3. prerender (React 19 streaming API):');
    const { prelude } = await prerender(<App name="World" />);
    const html3 = await streamToString(prelude);
    console.log(html3);
    console.log('\n');

    console.log('=== All tests completed ===');
}

runTests().catch(console.error);
