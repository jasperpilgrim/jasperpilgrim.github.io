(function () {
    document.documentElement.setAttribute('data-theme', 'dark');
})();

(function () {
    const contactForm = document.getElementById('contact-form');
    if (!contactForm) return;

    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    const formMessage = document.getElementById('form-message');

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoading.style.display = 'inline';
        formMessage.style.display = 'none';

        const formData = new FormData(contactForm);

        try {
            const response = await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (data.success) {
                formMessage.textContent = 'Message sent successfully!';
                formMessage.className = 'form-message success';
                formMessage.style.display = 'block';
                contactForm.reset();

                setTimeout(() => {
                    formMessage.style.display = 'none';
                }, 3000);
            } else {
                throw new Error(data.message || 'Failed to send message');
            }
        } catch (error) {
            formMessage.textContent = 'Sorry, there was an error sending your message. Please try again or use the email link below.';
            formMessage.className = 'form-message error';
            formMessage.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    });
})();
