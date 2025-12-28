export const modalPageRoutes = {
    aboutme: {
        title: "About me"
    },
    whatsapp: {
        title: "WhatsApp contact"
    },
    lens: {
        title: "Lens features"
    }
};

export function getModalRouteFromPath(pathname) {
    var match = pathname.match(/^\/pages\/([^/]+)\/?$/);
    if (!match) return null;

    const slug = match[1];
    const meta = modalPageRoutes[slug] || { title: slug };

    return {
        type: "modal",
        path: pathname,
        slug,
        title: meta.title,
    };
}
