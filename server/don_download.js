/**
 * Sistema de protección de descargas con Proof of Work
 * Validación server-side con Redis
 */

// Función SHA-256 nativa (Web Crypto API)
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    return await window.crypto.subtle.digest('SHA-256', msgBuffer);
}

// Función para computar Proof of Work
async function computeProofOfWork(challenge, difficulty = 3) {
    let nonce = 0;
    const target = '0'.repeat(difficulty);
    
    while (true) {
        const text = challenge + nonce;
        const hashBuffer = await sha256(text);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        if (hashHex.startsWith(target)) {
            return nonce;
        }
        
        nonce++;
        
        // Yield para no bloquear el navegador
        if (nonce % 1000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }
}

// Inicializar protección en botones
function initProtectedDownload() {
    const downloadButtons = document.querySelectorAll('.protected-download');
    
    if (downloadButtons.length === 0) return;
    
    downloadButtons.forEach(downloadBtn => {
        const contentId = downloadBtn.dataset.contentId;
        const tabla = downloadBtn.dataset.tabla;
        
        if (!contentId || !tabla) {
            console.error('Datos de descarga no válidos');
            return;
        }
        
        let isProcessing = false;
        let hasDownloaded = false;
        
        // Click handler con PoW + validación server-side
        downloadBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Si ya descargó, no hacer nada
            if (hasDownloaded) return;
            
            // Evitar clics múltiples
            if (isProcessing) return;
            isProcessing = true;
            
            // Cambiar texto del botón
            const originalText = downloadBtn.innerHTML;
            const originalClasses = downloadBtn.className; // Guardar clases originales
            
            downloadBtn.innerHTML = 'Generando...';
            downloadBtn.style.pointerEvents = 'none';
            
            try {
                // 1. Generar challenge on-demand
                const generateResponse = await fetch('/api_validate_pow.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'generate',
                        content_id: parseInt(contentId),
                        tabla: tabla
                    })
                });
                
                const generateResult = await generateResponse.json();
                
                if (!generateResponse.ok || !generateResult.success) {
                    throw new Error(generateResult.error || 'Error generando challenge');
                }
                
                const challenge = generateResult.challenge;
                
                // 2. Ejecutar Proof of Work
                downloadBtn.innerHTML = 'Descargando...';
                const nonce = await computeProofOfWork(challenge, 3);
                
                // 3. Enviar al servidor para validación
                const response = await fetch('/api_validate_pow.php', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'validate',
                        challenge: challenge,
                        nonce: nonce
                    })
                });
                
                let result = await response.json();
                
                // Manejo de Límite Excedido (Hard Block)
                if (response.status === 429 || result.status === 'limit_exceeded') {
                    await showLimitModal(result.wait_minutes || 60);
                    throw new Error('Límite Excedido');
                }
                
                // Manejo de Captcha (Rate Limit Soft Block)
                if (result.status === 'captcha_required') {
                    const solution = await showCaptchaModal(result.captcha_image, result.message);
                    
                    if (!solution) {
                        throw new Error('Verificación cancelada por el usuario');
                    }
                    
                    // Reintentar validación con captcha
                    downloadBtn.innerHTML = 'Verificando...';
                    
                    const response2 = await fetch('/api_validate_pow.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'validate',
                            challenge: challenge,
                            nonce: nonce,
                            captcha_solution: solution
                        })
                    });
                    
                    result = await response2.json();
                    
                    if (!response2.ok || !result.success) {
                        throw new Error(result.error || 'Captcha incorrecto');
                    }
                } else if (!response.ok || !result.success) {
                    throw new Error(result.error || 'Error en validación');
                }
                
                // Éxito
                hasDownloaded = true;
                handleDownloadSuccess(downloadBtn, result, contentId, tabla);
                isProcessing = false;
                
            } catch (error) {
                const msg = error.message || '';
                
                // Solo loguear errores inesperados en consola (ignorar flujo normal de cancelación/captcha)
                if (!msg.includes('cancelada') && !msg.includes('Captcha incorrecto') && !msg.includes('Límite')) {
                    console.error('Error en verificación:', error);
                }
                
                // Mensaje de error amigable para el usuario
                let userMsg = 'Error';
                
                if (msg.toLowerCase().includes('captcha')) {
                    userMsg = 'Captcha Incorrecto';
                } else if (msg.toLowerCase().includes('límite')) {
                    userMsg = 'Límite Excedido';
                } else if (msg.toLowerCase().includes('cancelada')) {
                    userMsg = 'Cancelado';
                } else if (msg.toLowerCase().includes('expirado')) {
                    userMsg = 'Tiempo Agotado';
                }
                
                // Restaurar botón con estado de error/advertencia
                downloadBtn.innerHTML = `${userMsg}`;
                
                // Forzar cambio de color: quitar azul, poner naranja
                downloadBtn.classList.remove('btn-primary');
                downloadBtn.classList.remove('bg-primary');
                downloadBtn.classList.add('btn-warning');
                downloadBtn.classList.add('bg-warning');
                downloadBtn.classList.add('text-dark');
                
                setTimeout(() => {
                    downloadBtn.innerHTML = originalText;
                    // Restaurar clases originales exactas (vuelve al azul)
                    downloadBtn.className = originalClasses;
                    downloadBtn.style.pointerEvents = 'auto';
                    isProcessing = false;
                }, 3000);
            }
        });
    });
}

// Función auxiliar para manejar éxito
function handleDownloadSuccess(downloadBtn, result, contentId, tabla) {
    // Marcar como descargado y cambiar a botón gris
    downloadBtn.innerHTML = 'Descargado';
    downloadBtn.className = 'text-white bg-secondary rounded-pill d-block shadow text-decoration-none my-1 p-1 protected-download';
    downloadBtn.style.pointerEvents = 'auto';
    
    // Disparar evento personalizado
    const downloadEvent = new CustomEvent('torrentDownloadComplete', {
        detail: { url: result.download_url, contentId: contentId, tabla: tabla }
    });
    document.dispatchEvent(downloadEvent);
    
    // Mostrar mensaje de compartir (retruk)
    setTimeout(() => {
        if (typeof $ !== 'undefined' && $('.retruk').length) {
            downloadBtn.style.display = 'none';
            $('.retruk').fadeIn('slow');
        }
    }, 100);
    
    // Iniciar descarga
    setTimeout(() => {
        window.location.href = result.download_url;
    }, 150);
}

// Función para mostrar modal de Captcha
function showCaptchaModal(imageUrl, message) {
    return new Promise((resolve) => {
        // Eliminar modal anterior si existe para asegurar bindings frescos
        const existingModal = document.getElementById('don-captcha-modal');
        if (existingModal) {
            // Intentar limpiar instancia de bootstrap si existe
            try { $(existingModal).modal('dispose'); } catch(e) {}
            existingModal.remove();
            $('.modal-backdrop').remove(); // Limpieza extra por si acaso
        }

        const modalHtml = `
        <div id="don-captcha-modal" class="modal fade" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false" style="z-index: 10000;">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content bg-dark text-white border-secondary">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title"><i class="fa fa-shield"></i> Verificación de Seguridad</h5>
                        <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body text-center">
                        <p class="mb-3">${message || 'Por favor, completa el captcha para continuar.'}</p>
                        <div class="mb-3 bg-secondary p-2 rounded d-inline-block">
                            <img id="don-captcha-img" src="${imageUrl}" class="img-fluid rounded" alt="Captcha">
                        </div>
                        <div class="form-group mt-2">
                            <input type="text" id="don-captcha-input" class="form-control bg-dark text-white border-secondary text-center text-uppercase font-weight-bold" placeholder="CÓDIGO" autocomplete="off" maxlength="5" style="font-size: 1.5rem; letter-spacing: 5px;">
                        </div>
                    </div>
                    <div class="modal-footer border-secondary justify-content-center">
                        <button type="button" id="don-captcha-submit" class="btn btn-primary btn-lg btn-block">Verificar y Descargar</button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('don-captcha-modal');
        const input = document.getElementById('don-captcha-input');
        const submitBtn = document.getElementById('don-captcha-submit');
        
        let resolved = false;

        // Handler para submit
        const submitHandler = () => {
            const val = input.value.trim();
            if (val) {
                resolved = true;
                input.blur();
                $('#don-captcha-modal').modal('hide');
                resolve(val.toUpperCase());
            } else {
                input.focus();
                input.classList.add('is-invalid');
                setTimeout(() => input.classList.remove('is-invalid'), 500);
            }
        };
        
        submitBtn.addEventListener('click', submitHandler);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitHandler();
        });
        
        // Prevenir warning de aria-hidden quitando el foco antes de ocultar
        $(modal).on('hide.bs.modal', function () {
            if (document.activeElement && modal.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        });
        
        // Handler para cancelar/cerrar
        $(modal).on('hidden.bs.modal', function (e) {
            if (!resolved) {
                resolve(null);
            }
            // Limpieza final tras animación
            setTimeout(() => {
                try { $(modal).modal('dispose'); } catch(e) {}
                modal.remove();
            }, 100);
        });
        
        $('#don-captcha-modal').modal('show');
        setTimeout(() => {
            if(document.getElementById('don-captcha-input')) {
                document.getElementById('don-captcha-input').focus();
            }
        }, 500);
    });
}

// Función para mostrar modal de Límite Excedido
function showLimitModal(minutes) {
    return new Promise((resolve) => {
        // Eliminar modal anterior si existe
        const existingModal = document.getElementById('don-limit-modal');
        if (existingModal) {
            try { $(existingModal).modal('dispose'); } catch(e) {}
            existingModal.remove();
            $('.modal-backdrop').remove();
        }

        const modalHtml = `
        <div id="don-limit-modal" class="modal fade" tabindex="-1" role="dialog" data-backdrop="static" data-keyboard="false" style="z-index: 10000;">
            <div class="modal-dialog modal-dialog-centered" role="document">
                <div class="modal-content bg-dark text-white border-danger">
                    <div class="modal-header border-danger">
                        <h5 class="modal-title text-danger"><i class="fa fa-exclamation-circle"></i> Límite Alcanzado</h5>
                        <button type="button" class="close text-white" data-dismiss="modal" aria-label="Close">
                            <span aria-hidden="true">&times;</span>
                        </button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-3">
                            <span style="font-size: 3rem;">🐌</span>
                        </div>
                        <h5 class="mb-3">Has alcanzado el límite de 60 descargas por hora.</h5>
                        <p class="lead">Por favor, espera <span class="text-warning font-weight-bold">${minutes} minutos</span> antes de continuar.</p>
                        <p class="text-muted small mt-3">Esto ayuda a mantener el servicio estable para todos.</p>
                    </div>
                    <div class="modal-footer border-danger justify-content-center">
                        <button type="button" class="btn btn-secondary" data-dismiss="modal">Entendido</button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('don-limit-modal');
        
        // Prevenir warning de aria-hidden quitando el foco antes de ocultar
        $(modal).on('hide.bs.modal', function () {
            if (document.activeElement && modal.contains(document.activeElement)) {
                document.activeElement.blur();
            }
        });
        
        $(modal).on('hidden.bs.modal', function (e) {
            resolve();
            setTimeout(() => {
                try { $(modal).modal('dispose'); } catch(e) {}
                modal.remove();
            }, 100);
        });
        
        $('#don-limit-modal').modal('show');
    });
}

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProtectedDownload);
} else {
    initProtectedDownload();
}
