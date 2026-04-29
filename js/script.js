document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) loadProjects();
    if (path.includes('login.html')) handleLogin();
    if (path.includes('upload.html')) handleUpload();
    if (path.includes('project.html')) loadProjectDetails();
    if (path.includes('profile.html')) loadUserProfile();
});

async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    updateAuthUI(session?.user);

    supabase.auth.onAuthStateChange((_event, session) => {
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

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else {
                const name = document.getElementById('reg-name').value;
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: { data: { full_name: name } }
                });
                if (error) throw error;
                if (data.user) {
                    await supabase.from('profiles').insert([{ id: data.user.id, full_name: name, email }]);
                }
            }
            window.location.href = 'index.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

async function loadProjects() {
    const grid = document.getElementById('project-list');
    if (!grid) return;

    try {
        const { data: projects, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        grid.innerHTML = '';
        
        if (!projects || projects.length === 0) {
            grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-gray);">Nenhum projeto encontrado.</p>';
            return;
        }

        projects.forEach(p => {
            grid.innerHTML += `
                <a href="project.html?id=${p.id}" class="project-card">
                    <div class="project-thumb">
                        <img src="${p.image_url}" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                    <div class="project-info">
                        <h3>${p.title}</h3>
                        <div class="project-meta">
                            <span>Por ${p.author_name}</span>
                            <span>❤️ ${p.likes || 0}</span>
                        </div>
                    </div>
                </a>
            `;
        });
    } catch (error) {
        console.error(error);
    }
}

function handleUpload() {
    const form = document.getElementById('upload-form');
    const fileInput = document.getElementById('proj-file');
    const fileName = document.getElementById('file-name');

    fileInput.addEventListener('change', () => {
        if (fileInput.files[0]) fileName.innerText = fileInput.files[0].name;
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return alert('Você precisa estar logado!');

        const title = document.getElementById('proj-title').value;
        const desc = document.getElementById('proj-desc').value;
        const stlFile = fileInput.files[0];
        const imgFile = document.getElementById('proj-image').files[0];

        if (stlFile.size > 20 * 1024 * 1024) return alert('Arquivo muito grande! Máximo 20MB.');

        document.getElementById('upload-progress').style.display = 'block';
        const bar = document.getElementById('progress-bar');
        const text = document.getElementById('progress-text');

        try {
            const stlPath = `stls/${Date.now()}_${stlFile.name}`;
            const { error: stlError } = await supabase.storage.from('files').upload(stlPath, stlFile);
            if (stlError) throw stlError;
            const { data: stlData } = supabase.storage.from('files').getPublicUrl(stlPath);

            const imgPath = `images/${Date.now()}_${imgFile.name}`;
            const { error: imgError } = await supabase.storage.from('files').upload(imgPath, imgFile);
            if (imgError) throw imgError;
            const { data: imgData } = supabase.storage.from('files').getPublicUrl(imgPath);

            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

            const { error: dbError } = await supabase.from('projects').insert([{
                title,
                description: desc,
                stl_url: stlData.publicUrl,
                image_url: imgData.publicUrl,
                author_id: user.id,
                author_name: profile?.full_name || user.user_metadata.full_name || 'Usuário',
                likes: 0,
                downloads: 0
            }]);

            if (dbError) throw dbError;

            alert('Projeto publicado com sucesso!');
            window.location.href = 'index.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

async function loadProjectDetails() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const container = document.getElementById('project-content');
    if (!id || !container) return;

    try {
        const { data: p, error } = await supabase.from('projects').select('*').eq('id', id).single();
        if (error || !p) return container.innerHTML = 'Projeto não encontrado.';

        container.innerHTML = `
            <div class="project-header">
                <div>
                    <h1>${p.title}</h1>
                    <p style="color: var(--text-gray)">Publicado por ${p.author_name}</p>
                </div>
                <div class="action-buttons">
                    <button class="btn-outline" onclick="likeProject('${id}')">❤️ Curtir</button>
                    <a href="${p.stl_url}" class="btn-primary" download onclick="countDownload('${id}')">⬇️ Baixar STL</a>
                </div>
            </div>
            <div id="viewer-3d"></div>
            <div class="project-description">
                <h3>Sobre este projeto</h3>
                <p style="margin-top: 1rem; white-space: pre-wrap;">${p.description}</p>
            </div>
            <div class="comment-section">
                <h3>Comentários</h3>
                <div id="comments-list" style="margin-top: 1.5rem;"></div>
                <div class="form-group" style="margin-top: 2rem;">
                    <textarea id="new-comment" placeholder="Deixe um comentário..." rows="3"></textarea>
                    <button class="btn-primary" style="margin-top: 1rem;" onclick="addComment('${id}')">Enviar Comentário</button>
                </div>
            </div>
        `;

        init3DViewer(p.stl_url);
        loadComments(id);
    } catch (error) {
        console.error(error);
    }
}

function init3DViewer(url) {
    const container = document.getElementById('viewer-3d');
    if (!container) return;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a20);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(100, 100, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    
    const light1 = new THREE.DirectionalLight(0xffffff, 1);
    light1.position.set(1, 1, 1);
    scene.add(light1);
    const light2 = new THREE.AmbientLight(0x404040);
    scene.add(light2);

    const loader = new THREE.STLLoader();
    loader.load(url, (geometry) => {
        const material = new THREE.MeshPhongMaterial({ color: 0x39FF14, specular: 0x111111, shininess: 200 });
        const mesh = new THREE.Mesh(geometry, material);
        
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        mesh.position.sub(center);
        
        scene.add(mesh);
    }, undefined, (error) => console.error(error));

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
        if (!container) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

async function loadUserProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    const name = profile?.full_name || user.user_metadata.full_name || 'Usuário';
    
    document.getElementById('profile-name').innerText = name;
    document.getElementById('profile-email').innerText = user.email;
    document.getElementById('profile-avatar').innerText = name[0].toUpperCase();

    const grid = document.getElementById('user-projects');
    const { data: projects } = await supabase.from('projects').select('*').eq('author_id', user.id);
    
    if (grid) {
        grid.innerHTML = '';
        projects?.forEach(p => {
            grid.innerHTML += `
                <div class="project-card">
                    <div class="project-thumb"><img src="${p.image_url}" style="width: 100%; height: 100%; object-fit: cover;"></div>
                    <div class="project-info">
                        <h3>${p.title}</h3>
                        <div class="project-meta"><span>❤️ ${p.likes}</span></div>
                    </div>
                </div>
            `;
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabase.auth.signOut();
            window.location.href = 'index.html';
        };
    }
}

async function likeProject(id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Faça login para curtir!');
    
    const { data: p } = await supabase.from('projects').select('likes').eq('id', id).single();
    await supabase.from('projects').update({ likes: (p.likes || 0) + 1 }).eq('id', id);
    alert('Você curtiu este projeto!');
    location.reload();
}

async function addComment(projectId) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('Faça login para comentar!');
    const text = document.getElementById('new-comment').value;
    if (!text) return;

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
    const name = profile?.full_name || user.user_metadata.full_name || 'Usuário';

    await supabase.from('comments').insert([{
        project_id: projectId,
        text,
        author_name: name,
        author_id: user.id
    }]);
    
    document.getElementById('new-comment').value = '';
    loadComments(projectId);
}

async function loadComments(projectId) {
    const list = document.getElementById('comments-list');
    const { data: comments } = await supabase
        .from('comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

    if (list) {
        list.innerHTML = '';
        comments?.forEach(c => {
            list.innerHTML += `
                <div class="comment-card">
                    <strong>${c.author_name}</strong>
                    <p style="margin-top: 0.5rem;">${c.text}</p>
                </div>
            `;
        });
    }
}
