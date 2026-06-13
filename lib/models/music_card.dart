class MusicCard {
  final String id;
  final String name;
  final String summary;
  final String fullContent;
  final String coverImage;
  final String musicFile;
  final DateTime createdAt;
  final List<String> tags;
  final String moodColor;

  const MusicCard({
    required this.id,
    required this.name,
    required this.summary,
    required this.fullContent,
    required this.coverImage,
    required this.musicFile,
    required this.createdAt,
    required this.tags,
    required this.moodColor,
  });

  MusicCard copyWith({
    String? id,
    String? name,
    String? summary,
    String? fullContent,
    String? coverImage,
    String? musicFile,
    DateTime? createdAt,
    List<String>? tags,
    String? moodColor,
  }) {
    return MusicCard(
      id: id ?? this.id,
      name: name ?? this.name,
      summary: summary ?? this.summary,
      fullContent: fullContent ?? this.fullContent,
      coverImage: coverImage ?? this.coverImage,
      musicFile: musicFile ?? this.musicFile,
      createdAt: createdAt ?? this.createdAt,
      tags: tags ?? this.tags,
      moodColor: moodColor ?? this.moodColor,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'summary': summary,
        'fullContent': fullContent,
        'coverImage': coverImage,
        'musicFile': musicFile,
        'createdAt': createdAt.toIso8601String(),
        'tags': tags,
        'moodColor': moodColor,
      };

  factory MusicCard.fromJson(Map<String, dynamic> json) => MusicCard(
        id: json['id'] as String,
        name: json['name'] as String,
        summary: json['summary'] as String,
        fullContent: json['fullContent'] as String,
        coverImage: json['coverImage'] as String,
        musicFile: json['musicFile'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
        tags: List<String>.from(json['tags'] as List),
        moodColor: json['moodColor'] as String,
      );
}
