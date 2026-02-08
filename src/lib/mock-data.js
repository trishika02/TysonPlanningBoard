export const MOCK_OPERATION_BULLETINS = [
    {
        "style": "T-Shirt (Blue)",
        "operation_bulletin_id": "OB-TSHIRT-001",
        "smv": 12.5,
        "total_manpower": 22,
        "learning_curve": "LC-Standard-Knit"
    },
    {
        "style": "Polo (Green)",
        "operation_bulletin_id": "OB-POLO-005",
        "smv": 18.2,
        "total_manpower": 25,
        "learning_curve": "LC-Complex-Polo"
    },
    {
        "style": "T-Shirt (Red)",
        "operation_bulletin_id": "OB-TSHIRT-001",
        "smv": 12.5,
        "total_manpower": 22,
        "learning_curve": "LC-Standard-Knit"
    },
    {
        "style": "Polo (Blue)",
        "operation_bulletin_id": "OB-POLO-005",
        "smv": 18.2,
        "total_manpower": 25,
        "learning_curve": "LC-Complex-Polo"
    },
    {
        "style": "Hoodie (Black)",
        "operation_bulletin_id": "OB-HOODIE-009",
        "smv": 25.0,
        "total_manpower": 30,
        "learning_curve": "LC-Complex-Polo"
    },
    {
        "style": "Tank Top (White)",
        "operation_bulletin_id": "OB-TANK-002",
        "smv": 8.5,
        "total_manpower": 18,
        "learning_curve": "LC-Standard-Knit"
    }
];

export const MOCK_LEARNING_CURVES = [
    {
        "name": "LC-Standard-Knit",
        "details": [
            { "day": 1, "efficiency": 15 },
            { "day": 2, "efficiency": 30 },
            { "day": 3, "efficiency": 50 },
            { "day": 4, "efficiency": 65 },
            { "day": 5, "efficiency": 75 }
        ]
    },
    {
        "name": "LC-Complex-Polo",
        "details": [
            { "day": 1, "efficiency": 10 },
            { "day": 2, "efficiency": 20 },
            { "day": 3, "efficiency": 35 },
            { "day": 4, "efficiency": 50 },
            { "day": 5, "efficiency": 60 },
            { "day": 6, "efficiency": 70 },
            { "day": 7, "efficiency": 75 }
        ]
    }
];
