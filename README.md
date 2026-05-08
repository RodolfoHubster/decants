# 🌸 Fitoscents — Sistema de Decants

Sistema web completo para administrar y vender decants de perfumes de diseñador.

## Estructura

```
├── login.html              ← Acceso al panel admin
├── index.html              ← Tienda pública
├── assets/
│   ├── css/
│   │   ├── variables.css
│   │   └── global.css
│   └── js/
│       ├── firebase-config.js
│       └── toast.js
└── admin/
    ├── auth-guard.js
    ├── sidebar.js
    ├── dashboard.html
    ├── categorias.html
    ├── marcas.html
    └── perfumes.html
```

## Reglas de Firestore

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /perfumes/{doc} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /{coll}/{doc} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## WhatsApp de contacto: 664-816-2623
