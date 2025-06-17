import React, { useState, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';
import remarkWikiLink from 'remark-wiki-link';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import './MarkdownEditor.css';

const MarkdownEditor = ({ file, content, onChange, projectFiles = [] }) => {
  const [localContent, setLocalContent] = useState(content);
  const [isPreview, setIsPreview] = useState(false);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = (e) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    onChange(newContent);
  };

  // Custom components for rendering
  const components = {
    // Code blocks with syntax highlighting
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={vscDarkPlus}
          language={match[1]}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Custom heading renderer that adds IDs (future MKDocs compatibility)
    h1({ children, ...props }) {
      const id = slugify(String(children));
      return (
        <h1 id={id} {...props}>
          {children}
          <a href={`#${id}`} className="header-anchor" aria-hidden="true">
            #
          </a>
        </h1>
      );
    },
    h2({ children, ...props }) {
      const id = slugify(String(children));
      return (
        <h2 id={id} {...props}>
          {children}
          <a href={`#${id}`} className="header-anchor" aria-hidden="true">
            #
          </a>
        </h2>
      );
    },
    h3({ children, ...props }) {
      const id = slugify(String(children));
      return (
        <h3 id={id} {...props}>
          {children}
          <a href={`#${id}`} className="header-anchor" aria-hidden="true">
            #
          </a>
        </h3>
      );
    },

    // Custom link renderer for internal wiki-style links
    a({ href, children, ...props }) {
      // Check if it's an internal wiki link
      if (href && href.startsWith('./') || href.endsWith('.md')) {
        const fileName = href.replace('./', '').replace('.md', '');
        const matchingFile = projectFiles.find(f => 
          f.name.toLowerCase().includes(fileName.toLowerCase())
        );
        
        return (
          <span 
            className={`wiki-link ${matchingFile ? 'valid' : 'invalid'}`}
            title={matchingFile ? `Go to ${matchingFile.name}` : 'File not found'}
            {...props}
          >
            {children}
          </span>
        );
      }
      
      // External links
      return (
        <a 
          href={href} 
          target={href?.startsWith('http') ? '_blank' : undefined}
          rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          {...props}
        >
          {children}
        </a>
      );
    },

    // Custom blockquote with types (admonitions - future MKDocs compatibility)
    blockquote({ children, ...props }) {
      const text = children[0]?.props?.children?.[0];
      let admonitionType = 'note';
      let content = children;

      // Check for admonition syntax like "!!! warning" or "!!! info"
      if (typeof text === 'string' && text.startsWith('!!!')) {
        const match = text.match(/^!!!\s+(\w+)\s*(.*)/);
        if (match) {
          admonitionType = match[1].toLowerCase();
          // Remove the admonition header from content
          content = children.slice(1);
        }
      }

      return (
        <div className={`admonition admonition-${admonitionType}`} {...props}>
          <div className="admonition-title">
            {getAdmonitionIcon(admonitionType)}
            {admonitionType.charAt(0).toUpperCase() + admonitionType.slice(1)}
          </div>
          <div className="admonition-content">
            {content}
          </div>
        </div>
      );
    },

    // Table of contents placeholder (future enhancement)
    p({ children, ...props }) {
      if (typeof children === 'string' && children.trim() === '[TOC]') {
        return (
          <div className="toc-placeholder" {...props}>
            📑 Table of Contents
            <small>(Will be generated automatically in published site)</small>
          </div>
        );
      }
      return <p {...props}>{children}</p>;
    }
  };

  // Simple slug generator for heading IDs
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // Get icon for admonition types
  const getAdmonitionIcon = (type) => {
    const icons = {
      note: '📝',
      tip: '💡',
      info: 'ℹ️',
      warning: '⚠️',
      danger: '🚨',
      success: '✅',
      question: '❓',
      quote: '💬'
    };
    return icons[type] || '📝';
  };

  // Wiki link processor (for future cross-referencing)
  const wikiLinkOptions = {
    pageResolver: (name) => [name.replace(/ /g, '-').toLowerCase()],
    hrefTemplate: (permalink) => `./${permalink}.md`,
    aliasDivider: '|'
  };

  return (
    <div className="markdown-editor">
      <div className="editor-tabs">
        <button 
          className={!isPreview ? 'active' : ''}
          onClick={() => setIsPreview(false)}
        >
          ✏️ Edit
        </button>
        <button 
          className={isPreview ? 'active' : ''}
          onClick={() => setIsPreview(true)}
        >
          👁️ Preview
        </button>
        <div className="tab-divider"></div>
        <div className="preview-info">
          <span className="preview-badge">MKDocs Ready</span>
        </div>
        <div className="file-info">
          <span className="file-icon">📄</span>
          {file.name}
        </div>
      </div>

      <div className="editor-body">
        {isPreview ? (
          <div className="markdown-preview mkdocs-preview">
            <Markdown
              remarkPlugins={[
                remarkGfm,
                remarkFrontmatter,
                [remarkWikiLink, wikiLinkOptions]
              ]}
              components={components}
            >
              {localContent}
            </Markdown>
          </div>
        ) : (
          <textarea
            className="markdown-textarea"
            value={localContent}
            onChange={handleChange}
            placeholder={`Start writing your markdown content...

Examples for enhanced preview:
# Main Heading
## Sub Heading

**Bold text** and *italic text*

\`\`\`javascript
console.log('Syntax highlighted code');
\`\`\`

> !!! tip
> This is a tip admonition for better documentation

[Link to another file](./other-file.md)
[[Wiki Style Link]]

[TOC]

- [x] Task list item
- [ ] Another task

| Table | Header |
|-------|--------|
| Cell  | Data   |`}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor; 