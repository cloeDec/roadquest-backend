import jwt from 'jsonwebtoken';
import { revokeToken, isTokenRevoked, clearBlacklist } from '../utils/tokenBlacklist';

describe('Token Blacklist', () => {
  const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

  beforeEach(() => {
    clearBlacklist();
  });

  const createToken = (expiresIn: string | number) => {
    return jwt.sign({ userId: 'test-user-id' }, JWT_SECRET, { expiresIn });
  };

  describe('revokeToken', () => {
    it('devrait ajouter un token valide à la blacklist', () => {
      const token = createToken('1h');

      revokeToken(token);

      expect(isTokenRevoked(token)).toBe(true);
    });

    it('ne devrait pas ajouter un token expiré à la blacklist', () => {
      // Créer un token déjà expiré
      const token = jwt.sign(
        { userId: 'test-user-id', exp: Math.floor(Date.now() / 1000) - 3600 },
        JWT_SECRET
      );

      revokeToken(token);

      expect(isTokenRevoked(token)).toBe(false);
    });

    it('ne devrait pas crasher avec un token invalide', () => {
      expect(() => revokeToken('invalid-token')).not.toThrow();
    });

    it('ne devrait pas crasher avec un token sans expiration', () => {
      const tokenWithoutExp = jwt.sign({ userId: 'test' }, JWT_SECRET);
      // Ce token n'a pas de exp explicite, donc decode retournera exp undefined
      expect(() => revokeToken(tokenWithoutExp)).not.toThrow();
    });
  });

  describe('isTokenRevoked', () => {
    it('devrait retourner false pour un token non révoqué', () => {
      const token = createToken('1h');

      expect(isTokenRevoked(token)).toBe(false);
    });

    it('devrait retourner true pour un token révoqué', () => {
      const token = createToken('1h');
      revokeToken(token);

      expect(isTokenRevoked(token)).toBe(true);
    });

    it('devrait retourner false pour un token jamais vu', () => {
      expect(isTokenRevoked('never-seen-token')).toBe(false);
    });
  });

  describe('Comportement avec différents tokens', () => {
    it('devrait gérer plusieurs tokens révoqués', () => {
      const token1 = createToken('1h');
      const token2 = createToken('2h');
      const token3 = createToken('3h');

      revokeToken(token1);
      revokeToken(token2);

      expect(isTokenRevoked(token1)).toBe(true);
      expect(isTokenRevoked(token2)).toBe(true);
      expect(isTokenRevoked(token3)).toBe(false);
    });

    it('devrait être idempotent (révoquer deux fois le même token)', () => {
      const token = createToken('1h');

      revokeToken(token);
      revokeToken(token);

      expect(isTokenRevoked(token)).toBe(true);
    });
  });
});
