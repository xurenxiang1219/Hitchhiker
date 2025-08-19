import React from 'react';
import hljs from 'highlight.js/lib/highlight';
import 'highlight.js/styles/tomorrow.css';

interface HighlightCodeProps {
    code: string;
    language?: string; // e.g. 'json', 'javascript', 'xml'
}

interface HighlightCodeState { }

class HighlightCode extends React.Component<HighlightCodeProps, HighlightCodeState> {

    private codeEl: HTMLElement | null = null;

    public componentDidMount() {
        hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));
        hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
        hljs.registerLanguage('xml', require('highlight.js/lib/languages/xml'));
        if (this.codeEl) {
            hljs.highlightBlock(this.codeEl);
        }
    }

    public componentDidUpdate(_prevProps: HighlightCodeProps, _prevState: HighlightCodeState) {
        if (this.codeEl) {
            hljs.highlightBlock(this.codeEl);
        }
    }

    public render() {
        const language = this.props.language || 'json';
        return (
            <pre style={{ background: '#f5f5f5', color: '#333', padding: 8, borderRadius: 4, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', border: 'none', outline: 'none' }}>
                <code
                    ref={el => (this.codeEl = el)}
                    className={`language-${language}`}
                >
                    {this.props.code}
                </code>
            </pre>
        );
    }
}

export default HighlightCode;