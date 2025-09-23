function validateRegistrationInput({ userName, password }) {
    const errors = []

    if (!userName || !password) {
        errors.push("userName and password required.")
    }

    if (!userName || typeof userName !== 'string' || userName.trim().length < 3) {
        errors.push("userName needs to be at least 3 characters.")
    }

    if (!password || typeof password !== 'string' || password.trim().length < 6) {
        errors.push("Password needs to be at least 6 characters.")
    }

    return errors
}

function validateLoginInput({ userName, password }) {
    const errors = []

    if (!userName || typeof userName !== "string") {
        errors.push("userName is required.");
    } else if (userName.trim().length < 3) {
        errors.push("userName must be at least 3 characters.");
    }

    if (!password || typeof password !== "string") {
        errors.push("Password is required.");
    } else if (password.trim().length === 0) {
        errors.push("Password cannot be empty.");
    }

    return errors
}

function validateProfileUpdateInput({
    password,
    heightFeetNum,
    heightInchesNum,
    weightNum,
}) {
    const errors = [];

    if (password !== null && password !== '') {
        if (typeof password !== "string" || password.length < 6) {
            errors.push("Password must be at least 6 characters.");
        }
    }

    if (heightFeetNum !== null) {
        if (typeof heightFeetNum !== 'number') {
            errors.push("Height must be a valid number.");
        }
    }

    if (heightInchesNum !== null) {
        if (typeof heightInchesNum !== 'number') {
            errors.push("Height must be a valid number.");
        }
    }

    if (weightNum !== null) {
        if (typeof weightNum !== 'number') {
            errors.push("Weight must be a valid number.");
        }
    }

    if (
        password === null &&
        heightFeetNum === null &&
        heightInchesNum === null &&
        weightNum === null
    ) {
        errors.push("At least one field must be provided to update.");
    }

    return errors;
}

module.exports = {
    validateRegistrationInput,
    validateLoginInput,
    validateProfileUpdateInput,
}