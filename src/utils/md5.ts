import crypto from 'crypto';

export default function md5(value: string): string | null {
	if (typeof value !== 'string') return null;
	
	return crypto
		.createHash('md5')
		.update(value)
		.digest('hex');
}