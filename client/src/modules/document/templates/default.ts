export const mainTpl = `<!DOCTYPE html>
<html>

<head>
	<style>
		html {
			height: 100%
		}

		body, code {
			height: 100%;
			font-size: 12px;
			font-family: Consolas,"Courier New", Arial, "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Helvetica, "Helvetica Neue For Number", sans-serif;
			padding: 0;
			margin: 0;
			overflow: hidden;
			color: rgba(0, 0, 0, 0.65);
		}

		body::after {
			display: block;
			content: '';
			clear: both;
		}

		li {
			list-style-type: none;
		}

		.document-main {
			background: white;
			width: 100%;
			padding: 16px;
			overflow: auto;
		}

		/* Harmonize with in-app styles */
		.card {
			background: #ffffff;
			border-radius: 10px;
			box-shadow: 0 6px 18px rgba(0,0,0,0.06);
			padding: 20px 20px 12px 20px;
			margin-bottom: 18px;
			border: 1px solid #f0f0f0;
		}

		.section {
			margin-bottom: 16px;
		}

		.section-title {
			font-size: 12px;
			font-weight: 600;
			letter-spacing: .06em;
			color: #6f7a89;
			text-transform: uppercase;
			margin: 6px 0 8px 0;
		}

		.document-record .document-block{
			padding-bottom: 12px;
			margin-bottom: 12px;
			border-bottom: 1px solid #f0f0f0;
		}
		.document-record .document-block:last-child{ border-bottom: 0; margin-bottom: 0; padding-bottom: 0; }

		.doc-card-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding-bottom: 8px;
			border-bottom: 1px dashed #eee;
			margin-bottom: 12px;
		}
		.doc-card-header::after{
			content: '';
			display: block;
			height: 2px;
			width: 36px;
			background: linear-gradient(90deg, #5b8ff9, #61d9a3);
			border-radius: 2px;
		}

		.sample-output{
			background: #fffbe6;
			border: 1px solid #d9d9d9;
			border-radius: 4px;
			padding: 12px;
		}

		.method-badge{
			display: inline-block;
			font-size: 11px;
			font-weight: 700;
			letter-spacing: .04em;
			padding: 2px 8px;
			border-radius: 12px;
			margin-right: 10px;
			border: 1px solid transparent;
			text-transform: uppercase;
		}
		.method-get    { background: #e6f7ff; color: #096dd9; border-color: #91d5ff; }
		.method-post   { background: #f6ffed; color: #237804; border-color: #b7eb8f; }
		.method-put    { background: #fff7e6; color: #ad6800; border-color: #ffe7ba; }
		.method-delete { background: #fff1f0; color: #a8071a; border-color: #ffa39e; }
		.method-patch  { background: #f9f0ff; color: #531dab; border-color: #d3adf7; }

		/* Parameter table styles */
		.param-table {
			width: 100%;
			border-collapse: collapse;
			margin: 10px 0;
		}
		.param-table th, .param-table td {
			border: 1px solid #e8e8e8;
			padding: 8px 12px;
			text-align: left;
			vertical-align: top;
		}
		.param-table tbody td:last-child { border-right: 0; }
		.param-table tbody tr:last-child td { border-bottom: 1px solid #d9d9d9; }
		/* cell roles */
		.param-key { width: 28%; white-space: nowrap; }
		.param-desc { width: 42%; }
		.param-value { width: 30%; color: #1f1f1f; }

		/* Inline pills and KV tags used in Data Mutation/Parameters */
		.inline-pill {
			display: inline-block;
			padding: 4px 8px;
			border-radius: 16px;
			background: #f5f7fa;
			border: 1px solid #e6ebf1;
			color: #2f3b52;
		}

		.kv-tag {
			display: inline-block;
			font-size: 10px;
			font-weight: 600;
			padding: 2px 6px;
			border-radius: 3px;
			margin-right: 6px;
			border: 1px solid transparent;
			text-transform: lowercase;
			letter-spacing: .02em;
		}
		.kv-header { background: #f0f0f0; border-color: #d9d9d9; color: #666; }
		.kv-query  { background: #f0f0f0; border-color: #d9d9d9; color: #666; }
		.kv-form   { background: #f0f0f0; border-color: #d9d9d9; color: #666; }

		/* Data Mutation type tags and optional marker */
		.optional-tag{
			margin-left: 6px;
			color: #999;
			font-weight: 600;
		}
		.type-tag{
			display: inline-block;
			font-size: 10px;
			font-weight: 700;
			padding: 2px 6px;
			border-radius: 3px;
			border: 1px solid transparent;
			text-transform: lowercase;
			letter-spacing: .02em;
		}
		.type-string { background: #fff0f6; color: #c41d7f; border-color: #ffadd2; }
		.type-number { background: #fff7e6; color: #d48806; border-color: #ffd591; }
		.type-boolean{ background: #f6ffed; color: #389e0d; border-color: #b7eb8f; }
		.type-object { background: #e6f7ff; color: #096dd9; border-color: #91d5ff; }
		.type-array  { background: #f9f0ff; color: #531dab; border-color: #d3adf7; }
		.type-null   { background: #fafafa; color: #8c8c8c; border-color: #e8e8e8; }

		/* Monospace for code-like values */
		.mono {
			font-family: SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace;
		}

		/* Use .card for spacing; no .document-record overrides here */

		.document-method-icon {
			font-size: 18px;
			padding-right: 8px;
		}

		.document-record-name {
			font-size: 18px;
			margin: 0 0 15px 0;
		}

		.document-record-desc {
			font-size: 14px;
			margin-bottom: 20px;
		}

		.document-record-url {
			font-size: 13px;
			border: 1px solid #e6e6e6;
			background: #f8f8f8;
			font-weight: 500;
			padding: 6px 10px;
			border-radius: 4px;
		}

		.document-header-name {
			font-size: 14px;
			margin-bottom: 12px;
			border-bottom: 1px solid #e6e6e6;
		}

		/* Basic info table styles to match in-app */
		.basic-info-table{
			width: 100%;
			border: 1px solid #d9d9d9;
			border-collapse: collapse;
			margin-bottom: 16px;
			background: #fff;
		}
		.basic-info-table tbody tr { border-bottom: 1px solid #d9d9d9; }
		.basic-info-table tbody tr:last-child { border-bottom: 1px solid #d9d9d9; }
		.basic-info-table .info-key{
			width: 120px;
			background: #f5f5f5;
			color: #333;
			font-weight: 600;
			font-size: 13px;
			padding: 8px 12px;
			border-right: 1px solid #d9d9d9;
			vertical-align: top;
		}
		.basic-info-table .info-value{
			padding: 8px 12px;
			vertical-align: top;
			word-break: break-all;
			background: #fff;
		}

		.document-header-key {
			font-weight: bold;
			word-wrap: break-word;
		}

		.document-header-value {
			word-wrap: break-word;
		}

		.document-header-desc {
			word-wrap: break-word;
		}

		.document-header-row:after {
			clear: both;
			content: "";
			display: block;
			height: 0;
		}

		.document-block {
			margin: 16px 0;
		}

		.document-code {
			border: 1px solid #e6e6e6;
			background: #f8f8f8;
			padding: 6px 10px;
			border-radius: 4px;
			max-height: 500px;
			overflow: auto;
		}
		/* make sure sample output keeps its intended background despite .document-code */
		.document-code.sample-output{
			background: #fffbe6;
			border-color: #d9d9d9;
		}

		.col-2 {
			width: 20%;
			padding: 4px 0px;
			float: left;
		}

		.col-4 {
			width: 40%;
			padding: 4px 0px;
			float: left;
		}
	</style>
	<style>
		.hljs-comment,
		.hljs-quote {
			color: #8e908c;
		}

		/* Tomorrow Red */

		.hljs-variable,
		.hljs-template-variable,
		.hljs-tag,
		.hljs-name,
		.hljs-selector-id,
		.hljs-selector-class,
		.hljs-regexp,
		.hljs-deletion {
			color: #c82829;
		}

		/* Tomorrow Orange */

		.hljs-number,
		.hljs-built_in,
		.hljs-builtin-name,
		.hljs-literal,
		.hljs-type,
		.hljs-params,
		.hljs-meta,
		.hljs-link {
			color: #f5871f;
		}

		/* Tomorrow Yellow */

		.hljs-attribute {
			color: #eab700;
		}

		/* Tomorrow Green */

		.hljs-string,
		.hljs-symbol,
		.hljs-bullet,
		.hljs-addition {
			color: #718c00;
		}

		/* Tomorrow Blue */

		.hljs-title,
		.hljs-section {
			color: #4271ae;
		}

		/* Tomorrow Purple */

		.hljs-keyword,
		.hljs-selector-tag {
			color: #8959a8;
		}

		.hljs {
			display: block;
			overflow-x: auto;
			background: white;
			color: #4d4d4c;
			padding: 0.5em;
		}

		.hljs-emphasis {
			font-style: italic;
		}

		.hljs-strong {
			font-weight: bold;
		}
	</style>
    <style>

        a {
            text-decoration-line: none;
            color: rgba(0, 0, 0, 0.65);
        }

        a:hover {
            color: rgba(0, 0, 255, 0.65);
        }

        .document-folder-title {
            line-height: 30px;
            cursor: pointer;
        }

        .document-folder-icon {
            vertical-align: -5px;
            font-size: 18px;
            margin-left: 16px;
            margin-right: 8px;
            width: 20px;
            display: inline-block;
        }

        .icon-close {
            height: 20px;
            background: url('data:image/svg+xml;utf8,<svg  width="20px" height="20px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path fill="#333333" d="M892 248H515.008q-2.016-0.992-3.008-2.016l-16-56q-4.992-26.016-27.008-43.488t-48-17.504H133.984q-28 0-48.512 20.512T64.96 200v624.992q0 28.992 20.512 49.504t48.512 20.512h758.016q28.992 0 48.992-20 20.992-20.992 20.992-51.008V317.984q0-28.992-20.512-49.504t-49.504-20.512z m-760-48q0-4 2.016-4h287.008q3.008 0 6.016 2.496t4 5.504L446.048 256H132.032V200z m762.016 624.992q0 0.992-0.992 2.016 0 0.992-0.992 0.992H134.016q-2.016 0-2.016-4V327.008h762.016v498.016z"/></svg>');
        }

        .icon-open {
            height: 20px;
            background: url('data:image/svg+xml;utf8,<svg width="20px" height="20px" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"><path fill="#333333" d="M960 384.4V264c0-39.8-32.2-72-72-72H489l-25-77.9C454.5 84.2 426.8 64 395.4 64H72C32.2 64 0 96.2 0 136v688.3c0 3.5 0.3 7 0.8 10.4 0 0.1 0 0.3 0.1 0.4 0.2 1 0.3 2 0.5 3 0.1 0.3 0.1 0.6 0.2 0.8 0.2 0.8 0.4 1.7 0.6 2.5 0.1 0.5 0.3 1 0.4 1.5l0.3 1.2c0.3 1.1 0.6 2.1 1 3.1v0.1c3.7 10.8 9.9 20.4 18 28.2l0.2 0.2c0.8 0.7 1.5 1.4 2.3 2.1 0.4 0.3 0.8 0.7 1.1 1 0.4 0.3 0.7 0.6 1.1 0.9 0.6 0.5 1.3 1 2 1.6 0.2 0.1 0.4 0.3 0.6 0.4 0.8 0.6 1.7 1.2 2.5 1.8 0.1 0 0.1 0.1 0.2 0.1 9.4 6.3 20.4 10.6 32.5 11.8 0.2 0 0.3 0 0.5 0.1 1.1 0.1 2.1 0.2 3.2 0.2h0.6c1.1 0 2.2 0.1 3.3 0.1h788c33 0 61.8-22.5 69.9-54.5l92-368c10.6-42.6-19.3-84.2-61.9-88.9zM72 136h323.2l41.2 128H888v120H164c-33 0-61.8 22.5-69.9 54.5L72 527.3V136z m788 688H72l92-368h788l-92 368z"/></svg>');
        }

        .font-icon {
            font-size: 12px;
            font-weight: bold;
            margin: auto;
			margin-top: 1px;
			color: #34515e;
		}
	
		[data-method="GET"] {
			color: #00e676;
		}
		
		[data-method="POST"] {
			color: #00b0ff;
		}
		
		[data-method="PUT"] {
			color: #651fff;
		}
		
		[data-method="DELETE"] {
			color: #ff1744;
		}
		
		[data-method="PATCH"] {
			color: #fbc02d;
		}

        ul {
            padding: 0;
            margin: 0;
        }

        .document-folder-content {
            padding-left: 25px;
        }

        .document-collection {
            line-height: 30px;
            background: #f1f1f1;
            margin-bottom: 8px;
            border-radius: 4px;
            vertical-align: middle;
            font-size: 14px;
            font-weight: bold;
			padding-left: 16px;
		}

		.record-icon {
			display: inline-block;
			width: 48px;
			min-width: 48px;
			text-align: center;
		}

		.item-with-menu-name{
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
			width: 250px;
			display: inline-block;
			vertical-align: bottom;
		}

		.folder-item-with-menu-name{
			width: 200px;
		}

        /* Modern left sidebar */
        #aside {
            width: 360px;
            float: left;
            padding: 16px 14px;
            background: #f7f9fc;
            overflow: auto;
            height: 100%;
            box-sizing: border-box;
            border-right: 1px solid #eef0f3;
            box-shadow: inset -1px 0 0 rgba(0,0,0,0.02);
        }

        #aside::-webkit-scrollbar { width: 10px; height: 10px; }
        #aside::-webkit-scrollbar-track { background: transparent; }
        #aside::-webkit-scrollbar-thumb {
            background-color: rgba(0,0,0,0.12);
            border-radius: 8px;
            border: 2px solid transparent;
            background-clip: content-box;
        }
        #aside::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.2); }

        #main {
            margin-left: 360px;
            height: 100%;
            overflow: auto;
            padding: 0 28px;
        }
    </style>

    <script>
		function expandFolder() {
			var folders = document.getElementsByClassName('document-folder-title');
			for (var f of folders) {
				(function () {
					let ft = f;
					ft.addEventListener('click', function (e) {
						e.preventDefault();
						e.stopPropagation();
						var classes = Array.prototype.slice.call(ft.classList);
						var isExpand = classes.indexOf('doc-folder-open') > -1;
						if (isExpand) {
							ft.classList.remove('doc-folder-open');
							ft.classList.add('doc-folder-close');
							ft.parentElement.querySelector(".document-folder-content").style.display =
								'none';
							ft.querySelector(".icon-close").style.display = '';
							ft.querySelector(".icon-open").style.display = 'none';
						} else {
							ft.classList.add('doc-folder-open');
							ft.classList.remove('doc-folder-close');
							ft.parentElement.querySelector(".document-folder-content").style.display = '';
							ft.querySelector(".icon-open").style.display = '';
							ft.querySelector(".icon-close").style.display = 'none';
						}
					});
				})();
			}
		}
    </script>
</head>

<body>
<div id="aside">
        <div class="document-collection">
            {{this.collectionName}}
        </div>
        <ul>
            {{for(let r of this.records){if(r.category===10){}}
            <li class="document-folder">
                <div class="document-folder-title">
					<span class="icon-close document-folder-icon"></span>
					<span class="icon-open document-folder-icon" style="display: none;"></span>
                    <span>{{r.name}}</span>
                </div>
                <ul class="document-folder-content" style="display: none" role="menu">
                    {{for(let c of r.children){}}
                    <li class="document-item" style="line-height: 30px; padding-left: 0px;">
					<span class="record  item-with-menu">
						<span class="record-icon">
							<span class="font-icon" data-method="{{c.method}}">{{c.method === 'DELETE' ? 'DEL' : c.method === 'OPTION' ? 'OPT' : c.method === 'CONNECT' ? 'CONN' : (c.method ||'GET')}}</span>
						</span>
						<a class="item-with-menu-name folder-item-with-menu-name" title="{{c.name}}" href="#{{c.id}}">
							{{c.name}}
						</a>
					</span>
                    </li>
                    {{}}}
                </ul>
            </li>
            {{}else{}}
            <li class="document-item" style="line-height: 30px; padding-left: 0px;">
                <span class="record  item-with-menu">
                    <span class="record-icon">
                        <span class="font-icon" data-method="{{r.method}}" >{{r.method === 'DELETE' ? 'DEL' : r.method === 'OPTION' ? 'OPT' : r.method === 'CONNECT' ? 'CONN' : (r.method ||'GET')}}</span>
                    </span>
                    <a class="item-with-menu-name" title="{{r.name}}" href="#{{r.id}}">
                        {{r.name}}
                    </a>
                </span>
            </li>
            {{}}}
            {{}}}
        </ul>
    </div>
    <div id="main">
		{{this.doc}}
    </div>
    <script>
        expandFolder();
    </script>
</body>

</html>`;