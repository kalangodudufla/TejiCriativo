// ─── INICIALIZAÇÃO ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) loadProjects();
    if (path.includes('login.html')) handleLogin();
    if (path.includes('upload.html')) handleUpload();
    if (path.includes('project.html')) loadProjectDetails();
    if (path.includes('profile.html')) loadUserProfile();
});

// ─── AUTENTICAÇÃO ────────────────────────────────────────────────────────────
async function initAuth() {
    // FIX: usar "db" em vez de "supabase" (variável renomeada no supabase.js)
    const { data: { session } } = await db.auth.getSession();
    updateAuthUI(session?.user);

    db.auth.onAuthStateChange((_event, session) => {
        updateAuthUI(session?.user);
    });
}

function updateAuthUI(user) {
    const authLinks = document.getElementById('auth-links');
    if (authLinks) {
        if (user) {
            authLinks.innerHTML = `<a href="profile.html" class="btn-primary">Meu Perfil</a>`;
        } else {
            authLinks.innerHTML = `<a href="login.html" class="btn-outline">Entrar</a>`;
        }
    }
}

function handleLogin() {
    const form = document.getElementById('auth-form');
    const toggleBtn = document.getElementById('toggle-auth');
    const title = document.getElementById('auth-title');
    const nameGroup = document.getElementById('name-group');
    const btn = document.getElementById('auth-btn');
    let isLogin = true;

    toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        isLogin = !isLogin;
        title.innerText = isLogin ? 'Bem-vindo de volta' : 'Crie sua conta';
        btn.innerText = isLogin ? 'Entrar' : 'Cadastrar';
        nameGroup.style.display = isLogin ? 'none' : 'block';
        document.getElementById('toggle-text').innerText = isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?';
        toggleBtn.innerText = isLogin ? 'Criar conta' : 'Fazer login';
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('auth-email').value;
        const password = document.getElementById('auth-password').value;
        btn.disabled = true;
        btn.innerText = 'Aguarde...';

        try {
            if (isLogin) {
                // FIX: usando "db" corretamente
                const { error } = await db.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const name = document.getElementById('reg-name').value;
                if (!name.trim()) throw new Error('Por favor, informe seu nome.');

                const { data, error } = await db.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });
                if (error) throw error;

                // FIX: signUp pode retornar user null se confirmação de e-mail estiver ativa
                if (data.user && !data.user.identities?.length === 0) {
                    await db.from('profiles').upsert([{ id: data.user.id, full_name: name, email }]);
                } else if (data.user) {
                    await db.from('profiles').upsert([{ id: data.user.id, full_name: name, email }]);
                    window.location.href = 'index.html';
                    return;
                } else {
                    alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta.');
                    return;
                }
            }
            window.location.href = 'index.html';
        } catch (error) {
            alert(error.message);
            btn.disabled = false;
            btn.innerText = isLogin ? 'Entrar' : 'Cadastrar';
        }
    });
}

// ─── LISTAGEM DE PROJETOS ─────────────────────────────────────────────────────
async function loadProjects(filter = 'recent', query = '') {
    const grid = document.getElementById('project-list');
    if (!grid) return;

    grid.innerHTML = `<div class="loader-container" style="grid-column: 1/-1; text-align: center; padding: 3rem;"><span class="loader"></span></div>`;

    try {
        let req = db.from('projects').select('*');

        // FIX: implementar busca e ordenação que antes eram ignoradas
        if (query.trim()) {
            req = req.ilike('title', `%${query.trim()}%`);
        }

        if (filter === 'popular') {
            req = req.order('likes', { ascending: false });
        } else {
            req = req.order('created_at', { ascending: false });
        }

        const { data: projects, error } = await req;
        if (error) throw error;

        grid.innerHTML = '';

        if (!projects || projects.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-gray);">Nenhum projeto encontrado.</p>';
            return;
        }

        projects.forEach(p => {
            // FIX: escapar HTML para evitar XSS
            const safeTitle = escapeHtml(p.title);
            const safeAuthor = escapeHtml(p.author_name);
            grid.innerHTML += `
                <a href="project.html?id=${p.id}" class="project-card">
                    <div class="project-thumb">
                        <img src="${p.image_url}" alt="${safeTitle}" style="width: 100%; height: 100%; object-fit: cover;" 
                             onerror="this.style.display='none'">
                    </div>
                    <div class="project-info">
                        <h3>${safeTitle}</h3>
                        <div class="project-meta">
                            <span>Por ${safeAuthor}</span>
                            <span>❤️ ${p.likes || 0}</span>
                        </div>
                    </div>
                </a>
            `;
        });

        // FIX: conectar filtros e busca que antes não tinham listeners
        const sortFilter = document.getElementById('sort-filter');
        const searchInput = document.getElementById('search-input');

        if (sortFilter && !sortFilter._listenerAdded) {
            sortFilter._listenerAdded = true;
            sortFilter.addEventListener('change', () => {
                loadProjects(sortFilter.value, searchInput?.value || '');
            });
        }

        if (searchInput && !searchInput._listenerAdded) {
            searchInput._listenerAdded = true;
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    loadProjects(sortFilter?.value || 'recent', searchInput.value);
                }, 400);
            });
        }

    } catch (error) {
        console.error(error);
        grid.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: #ff6b6b;">Erro ao carregar projetos: ${escapeHtml(error.message)}</p>`;
    }
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
function handleUpload() {
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('proj-file');
    const fileName = document.getElementById('file-name');

    if (!form) return;

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) fileName.innerText = fileInput.files[0].name;
    });

    // Suporte a drag-and-drop na área de upload
    const dropArea = fileInput.closest('[onclick]');
    if (dropArea) {
        dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.style.borderColor = 'var(--neon-green)'; });
        dropArea.addEventListener('dragleave', () => { dropArea.style.borderColor = 'rgba(255,255,255,0.1)'; });
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.style.borderColor = 'rgba(255,255,255,0.1)';
            if (e.dataTransfer.files[0]) {
                fileInput.files = e.dataTransfer.files;
                fileName.innerText = e.dataTransfer.files[0].name;
            }
        });
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await db.auth.getUser();
        if (!user) return alert('Você precisa estar logado!');

        const title = document.getElementById('proj-title').value.trim();
        const desc = document.getElementById('proj-desc').value.trim();
        const stlFile = fileInput.files[0];
        const imgFile = document.getElementById('proj-image').files[0];

        if (!stlFile) return alert('Selecione um arquivo STL.');
        if (!imgFile) return alert('Selecione uma imagem de capa.');
        if (stlFile.size > 20 * 1024 * 1024) return alert('Arquivo STL muito grande! Máximo 20MB.');

        const progressDiv = document.getElementById('upload-progress');
        const bar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        const uploadBtn = document.getElementById('upload-btn');

        progressDiv.style.display = 'block';
        uploadBtn.disabled = true;
        uploadBtn.innerText = 'Publicando...';

        const setProgress = (pct, msg) => {
            bar.style.width = pct + '%';
            progressText.innerText = msg;
        };

        try {
            setProgress(10, 'Enviando arquivo STL...');
            const stlPath = `stls/${user.id}_${Date.now()}_${stlFile.name.replace(/\s/g, '_')}`;
            const { error: stlError } = await db.storage.from('files').upload(stlPath, stlFile);
            if (stlError) throw stlError;
            const { data: stlData } = db.storage.from('files').getPublicUrl(stlPath);

            setProgress(50, 'Enviando imagem de capa...');
            const imgPath = `images/${user.id}_${Date.now()}_${imgFile.name.replace(/\s/g, '_')}`;
            const { error: imgError } = await db.storage.from('files').upload(imgPath, imgFile);
            if (imgError) throw imgError;
            const { data: imgData } = db.storage.from('files').getPublicUrl(imgPath);

            setProgress(80, 'Salvando projeto...');
            const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).single();

            const { error: dbError } = await db.from('projects').insert([{
                title,
                description: desc,
                stl_url: stlData.publicUrl,
                image_url: imgData.publicUrl,
                author_id: user.id,
                author_name: profile?.full_name || user.user_metadata?.full_name || 'Usuário',
                likes: 0,
                downloads: 0
            }]);

            if (dbError) throw dbError;

            setProgress(100, 'Publicado com sucesso! ✅');
            setTimeout(() => { window.location.href = 'index.html'; }, 1000);

        } catch (error) {
            alert('Erro ao publicar: ' + error.message);
            progressDiv.style.display = 'none';
            uploadBtn.disabled = false;
            uploadBtn.innerText = 'Publicar Projeto';
        }
    });
}

// ─── DETALHES DO PROJETO ──────────────────────────────────────────────────────
async function loadProjectDetails() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const container = document.getElementById('project-content');
    if (!id || !container) return;

    try {
        const { data: p, error } = await db.from('projects').select('*').eq('id', id).single();
        if (error || !p) {
            container.innerHTML = '<p style="text-align:center;padding:4rem;color:var(--text-gray);">Projeto não encontrado.</p>';
            return;
        }

        const safeTitle = escapeHtml(p.title);
        const safeAuthor = escapeHtml(p.author_name);
        const safeDesc = escapeHtml(p.description);

        container.innerHTML = `
            <div class="project-header">
                <div>
                    <h1>${safeTitle}</h1>
                    <p style="color: var(--text-gray)">Publicado por ${safeAuthor}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn-outline" id="like-btn" onclick="likeProject('${id}')">❤️ Curtir (${p.likes || 0})</button>
                    <a href="${p.stl_url}" class="btn-primary" download onclick="countDownload('${id}')">⬇️ Baixar STL</a>
                </div>
            </div>
            <div id="viewer-3d"></div>
            <div class="project-description">
                <h3>Sobre este projeto</h3>
                <p style="margin-top: 1rem; white-space: pre-wrap;">${safeDesc}</p>
            </div>
            <div class="comment-section">
                <h3>Comentários</h3>
                <div id="comments-list" style="margin-top: 1.5rem;"></div>
                <div class="form-group" style="margin-top: 2rem;">
                    <textarea id="new-comment" placeholder="Deixe um comentário..." rows="3" 
                              style="width:100%;padding:1rem;background:#25252d;border:1px solid rgba(255,255,255,0.1);border-radius:12px;color:white;outline:none;resize:vertical;"></textarea>
                    <button class="btn-primary" style="margin-top: 1rem;" onclick="addComment('${id}')">Enviar Comentário</button>
                </div>
            </div>
        `;

        init3DViewer(p.stl_url);
        loadComments(id);

    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center;padding:4rem;color:#ff6b6b;">Erro ao carregar projeto.</p>';
    }
}

// ─── VIEWER 3D ────────────────────────────────────────────────────────────────
function init3DViewer(url) {
    const container = document.getElementById('viewer-3d');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a20);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 5000);
    camera.position.set(100, 100, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // FIX: OrbitControls em r128 via CDN separado está disponível como THREE.OrbitControls
    // se o script examples/js/controls/OrbitControls.js foi carregado (ele adiciona a THREE)
    let controls;
    if (THREE.OrbitControls) {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
    }

    const light1 = new THREE.DirectionalLight(0xffffff, 1.2);
    light1.position.set(1, 2, 1);
    scene.add(light1);
    const light2 = new THREE.DirectionalLight(0x8866ff, 0.4);
    light2.position.set(-1, -1, -1);
    scene.add(light2);
    const ambient = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambient);

    // Loader com mensagem de carregamento
    const loadingMsg = document.createElement('div');
    loadingMsg.innerText = 'Carregando modelo 3D...';
    loadingMsg.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#a0a0a0;font-size:0.9rem;';
    container.style.position = 'relative';
    container.appendChild(loadingMsg);

    // FIX: STLLoader também é adicionado via script separado como THREE.STLLoader
    if (!THREE.STLLoader) {
        loadingMsg.innerText = 'Visualizador 3D indisponível.';
        return;
    }

    const loader = new THREE.STLLoader();
    loader.load(url, (geometry) => {
        loadingMsg.remove();
        const material = new THREE.MeshPhongMaterial({
            color: 0x39FF14,
            specular: 0x444444,
            shininess: 100,
        });
        const mesh = new THREE.Mesh(geometry, material);

        // Centralizar e escalar o modelo automaticamente
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        mesh.position.sub(center);

        const size = new THREE.Vector3();
        bbox.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 100 / maxDim;
        mesh.scale.setScalar(scale);

        scene.add(mesh);

        // Ajustar câmera para o tamanho real do modelo
        const dist = 150;
        camera.position.set(dist, dist, dist);
        camera.lookAt(0, 0, 0);
        if (controls) controls.target.set(0, 0, 0);

    }, undefined, (err) => {
        console.error('Erro ao carregar STL:', err);
        loadingMsg.innerText = 'Erro ao carregar o modelo 3D.';
    });

    function animate() {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!container.clientWidth) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// ─── PERFIL DO USUÁRIO ────────────────────────────────────────────────────────
async function loadUserProfile() {
    const { data: { user } } = await db.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single();
    const name = profile?.full_name || user.user_metadata?.full_name || 'Usuário';

    document.getElementById('profile-name').innerText = name;
    document.getElementById('profile-email').innerText = user.email;
    document.getElementById('profile-avatar').innerText = name[0].toUpperCase();

    const grid = document.getElementById('user-projects');
    const { data: projects } = await db.from('projects').select('*').eq('author_id', user.id).order('created_at', { ascending: false });

    if (grid) {
        if (!projects || projects.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-gray);">Você ainda não publicou projetos.</p>';
        } else {
            grid.innerHTML = '';
            projects.forEach(p => {
                const safeTitle = escapeHtml(p.title);
                grid.innerHTML += `
                    <a href="project.html?id=${p.id}" class="project-card">
                        <div class="project-thumb">
                            <img src="${p.image_url}" alt="${safeTitle}" style="width: 100%; height: 100%; object-fit: cover;" 
                                 onerror="this.style.display='none'">
                        </div>
                        <div class="project-info">
                            <h3>${safeTitle}</h3>
                            <div class="project-meta">
                                <span>❤️ ${p.likes || 0}</span>
                                <span>⬇️ ${p.downloads || 0}</span>
                            </div>
                        </div>
                    </a>
                `;
            });
        }
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await db.auth.signOut();
            window.location.href = 'index.html';
        };
    }
}

// ─── CURTIR PROJETO ───────────────────────────────────────────────────────────
async function likeProject(id) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return alert('Faça login para curtir!');

    const btn = document.getElementById('like-btn');
    if (btn) btn.disabled = true;

    try {
        const { data: p } = await db.from('projects').select('likes').eq('id', id).single();
        const newLikes = (p?.likes || 0) + 1;
        await db.from('projects').update({ likes: newLikes }).eq('id', id);
        if (btn) {
            btn.innerText = `❤️ Curtido! (${newLikes})`;
        }
    } catch (err) {
        console.error(err);
        if (btn) btn.disabled = false;
    }
}

// ─── FIX: countDownload estava chamado no HTML mas nunca definido ─────────────
async function countDownload(id) {
    try {
        const { data: p } = await db.from('projects').select('downloads').eq('id', id).single();
        await db.from('projects').update({ downloads: (p?.downloads || 0) + 1 }).eq('id', id);
    } catch (err) {
        console.error('Erro ao contabilizar download:', err);
    }
}

// ─── COMENTÁRIOS ──────────────────────────────────────────────────────────────
async function addComment(projectId) {
    const { data: { user } } = await db.auth.getUser();
    if (!user) return alert('Faça login para comentar!');

    const textarea = document.getElementById('new-comment');
    const text = textarea?.value?.trim();
    if (!text) return alert('Digite um comentário antes de enviar.');

    try {
        const { data: profile } = await db.from('profiles').select('full_name').eq('id', user.id).single();
        const name = profile?.full_name || user.user_metadata?.full_name || 'Usuário';

        const { error } = await db.from('comments').insert([{
            project_id: projectId,
            text,
            author_name: name,
            author_id: user.id
        }]);

        if (error) throw error;
        textarea.value = '';
        loadComments(projectId);
    } catch (err) {
        alert('Erro ao enviar comentário: ' + err.message);
    }
}

async function loadComments(projectId) {
    const list = document.getElementById('comments-list');
    if (!list) return;

    list.innerHTML = '<p style="color:var(--text-gray);font-size:0.9rem;">Carregando comentários...</p>';

    const { data: comments, error } = await db
        .from('comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (error) {
        list.innerHTML = '<p style="color:#ff6b6b;">Erro ao carregar comentários.</p>';
        return;
    }

    if (!comments || comments.length === 0) {
        list.innerHTML = '<p style="color:var(--text-gray);">Nenhum comentário ainda. Seja o primeiro!</p>';
        return;
    }

    list.innerHTML = '';
    comments.forEach(c => {
        list.innerHTML += `
            <div class="comment-card">
                <strong>${escapeHtml(c.author_name)}</strong>
                <p style="margin-top: 0.5rem;">${escapeHtml(c.text)}</p>
            </div>
        `;
    });
}

// ─── UTILITÁRIO: Prevenir XSS ─────────────────────────────────────────────────
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}