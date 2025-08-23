const express                     = require('express');
const { body, param, validationResult } = require('express-validator');
const dataService                 = require('./dataService');
const router                      = express.Router();

// Validation helper
function validate(req, res, next) {
  const errs = validationResult(req);
  if (!errs.isEmpty()) return res.status(400).json({ errors: errs.array() });
  next();
}

// Auth
router.post('/login', [
  body('email').isEmail(),
  body('password').isString().notEmpty()
], validate, async (req, res) => {
  try {
    const { token, roles } = await dataService.authenticate(req.body);
    res.json({ token, roles });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.post('/refresh', [
  body('token').isJWT()
], validate, (req, res) => {
  try {
    const token = dataService.refreshToken(req.body.token);
    res.json({ token });
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

// Users
router.post('/users', [
  body('firstName').isString().notEmpty(),
  body('lastName').isString().notEmpty(),
  body('grade').isString().notEmpty(),
  body('special').isBoolean(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], validate, async (req, res) => {
  try {
    const { id, token } = await dataService.createUser(req.body);
    res.status(201).json({ id, token });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post('/users/from-existing', [
  body('individualId').isUUID(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 })
], validate, async (req, res) => {
  try {
    const info = await dataService.createCredentialsForExistingIndividual(req.body);
    res.status(201).json(info);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Individuals
router.post('/individuals', [
  body('firstName').isString().notEmpty(),
  body('lastName').isString().notEmpty(),
  body('grade').isString().notEmpty(),
  body('special').isBoolean(),
  body('createdBy').optional().isUUID()
], validate, async (req, res) => {
  try {
    const id = await dataService.createIndividual(req.body);
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Entities
router.post('/entities', [
  body('name').isString().notEmpty(),
  body('addressId').isUUID(),
  body('supportOrganizationId').optional().isUUID(),
  body('type').isString().notEmpty(),
  body('denominationId').isInt(),
  body('createdBy').optional().isUUID()
], validate, async (req, res) => {
  try {
    const id = await dataService.createEntity(req.body);
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Events
router.post('/events', [
  body('title').isString().notEmpty(),
  body('type').isString().notEmpty(),
  body('denominationId').isInt(),
  body('addressId').isUUID(),
  body('supportOrganizationId').optional().isUUID(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  body('start').isISO8601(),
  body('finish').isISO8601(),
  body('comments').optional().isString(),
  body('createdBy').optional().isUUID()
], validate, async (req, res) => {
  try {
    const id = await dataService.createEvent(req.body);
    res.status(201).json({ id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
